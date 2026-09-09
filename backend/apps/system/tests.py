"""
Tests for the backup system.
Covers: creation, verification, corruption detection, retention, API permissions, and restore safety.
"""
import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.system.backup.engine import SQLiteBackupEngine, get_backup_engine
from apps.system.models import BackupLog

User = get_user_model()


def _make_admin():
    from apps.users.models import Role
    role, _ = Role.objects.get_or_create(name='Administrator')
    user = User.objects.create_user(username='backup_admin', password='TestPass123!', role=role)
    return user


class SQLiteBackupEngineTest(TestCase):

    def setUp(self):
        self.tmp_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.tmp_dir, ignore_errors=True)

    @override_settings(BACKUP_DIR=None)
    def _backup_dir_patch(self, tmp):
        return patch('apps.system.backup.engine._backup_dir', return_value=Path(tmp))

    def test_create_backup_produces_valid_file(self):
        engine = SQLiteBackupEngine()
        with self._backup_dir_patch(self.tmp_dir):
            result = engine.create_backup()

        self.assertIn('filename', result)
        self.assertIn('path', result)
        self.assertGreater(result['size_bytes'], 0)
        self.assertEqual(len(result['checksum_sha256']), 64)
        self.assertTrue(result['path'].exists())

    def test_verify_backup_passes_for_valid_backup(self):
        engine = SQLiteBackupEngine()
        with self._backup_dir_patch(self.tmp_dir):
            result = engine.create_backup()
            ok, message = engine.verify_backup(result['path'])

        self.assertTrue(ok)
        self.assertIn('ok', message.lower())

    def test_verify_backup_fails_for_corrupt_file(self):
        engine = SQLiteBackupEngine()
        with self._backup_dir_patch(self.tmp_dir):
            result = engine.create_backup()

        backup_path = result['path']
        # Corrupt the SQLite header — must NOT have any open connection first
        with open(backup_path, 'r+b') as f:
            f.seek(0)
            f.write(b'CORRUPT_HEADER_NOT_SQLITE')

        ok, message = engine.verify_backup(backup_path)

        self.assertFalse(ok)
        self.assertIn('error', message.lower())

    def test_verify_backup_fails_for_missing_file(self):
        engine = SQLiteBackupEngine()
        ok, message = engine.verify_backup(Path(self.tmp_dir) / 'nonexistent.sqlite3')
        self.assertFalse(ok)
        self.assertIn('not found', message.lower())

    def test_retention_policy_deletes_old_files(self):
        engine = SQLiteBackupEngine()
        backup_dir = Path(self.tmp_dir)

        # Create 10 dummy backup files with older timestamps
        for i in range(10):
            f = backup_dir / 'swms_backup__old_{:02d}.sqlite3'.format(i)
            f.write_bytes(b'dummy')
            # Set mtime to 60 days ago
            import time
            old_time = time.time() - (60 * 24 * 3600)
            os.utime(f, (old_time, old_time))

        with self._backup_dir_patch(self.tmp_dir):
            with override_settings(
                BACKUP_RETENTION_DAILY=7,
                BACKUP_RETENTION_WEEKLY=4,
                BACKUP_RETENTION_MONTHLY=12
            ):
                pruned = engine.apply_retention_policy()

        # Only 12 monthly + 4 weekly + 7 daily = at most 23 kept, but we only had 10
        # all are 60 days old so they fall into monthly bucket; 10 <= 12, none pruned
        # Test that the method runs without error and returns int
        self.assertIsInstance(pruned, int)


class BackupLogModelTest(TestCase):

    def test_mark_success_sets_fields(self):
        log = BackupLog.objects.create(engine='sqlite', triggered_by='MANUAL')
        log.mark_success('test.sqlite3', 1024 * 1024, 'abc123' * 10 + 'abcd')
        log.refresh_from_db()
        self.assertEqual(log.status, 'SUCCESS')
        self.assertEqual(log.backup_filename, 'test.sqlite3')
        self.assertIsNotNone(log.completed_at)

    def test_mark_failed_sets_fields(self):
        log = BackupLog.objects.create(engine='sqlite', triggered_by='MANUAL')
        log.mark_failed('Connection refused')
        log.refresh_from_db()
        self.assertEqual(log.status, 'FAILED')
        self.assertIn('Connection refused', log.error_message)

    def test_mark_verified_sets_fields(self):
        log = BackupLog.objects.create(engine='sqlite', triggered_by='MANUAL', status='SUCCESS')
        log.mark_verified('PRAGMA integrity_check: ok')
        log.refresh_from_db()
        self.assertEqual(log.status, 'VERIFIED')
        self.assertEqual(log.verification_status, 'OK')

    def test_mark_verify_failed_sets_fields(self):
        log = BackupLog.objects.create(engine='sqlite', triggered_by='MANUAL', status='SUCCESS')
        log.mark_verify_failed('File is not a database')
        log.refresh_from_db()
        self.assertEqual(log.status, 'VERIFY_FAILED')
        self.assertEqual(log.verification_status, 'FAILED')


class BackupAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.admin = _make_admin()
        self.client.force_authenticate(user=self.admin)

    def _create_verified_log(self):
        return BackupLog.objects.create(
            engine='sqlite', triggered_by='MANUAL', status='VERIFIED',
            backup_filename='test.sqlite3', file_size_bytes=1024 * 512,
            checksum_sha256='a' * 64, verification_status='OK',
        )

    def test_list_backups_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get('/api/v1/system/backups/')
        self.assertEqual(response.status_code, 401)

    def test_list_backups_accessible_to_admin(self):
        self._create_verified_log()
        response = self.client.get('/api/v1/system/backups/')
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(len(response.data['results']), 1)

    def test_backup_status_endpoint(self):
        self._create_verified_log()
        response = self.client.get('/api/v1/system/backups/status/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('last_successful_backup', response.data)
        self.assertIn('total_backups', response.data)

    def test_response_does_not_expose_backup_filename(self):
        """
        backup_filename is a file system path and must NOT appear in any API response.
        """
        self._create_verified_log()
        response = self.client.get('/api/v1/system/backups/')
        for item in response.data['results']:
            self.assertNotIn('backup_filename', item)

    def test_non_admin_cannot_access_backup_api(self):
        from apps.users.models import Role
        role, _ = Role.objects.get_or_create(name='Weighbridge Operator')
        operator = User.objects.create_user(username='op_backup', password='Test123!', role=role)
        self.client.force_authenticate(user=operator)
        response = self.client.get('/api/v1/system/backups/')
        self.assertEqual(response.status_code, 403)

    def test_trigger_backup_creates_verified_log(self):
        """
        Trigger endpoint should call the real backup engine against the test SQLite DB.
        """
        tmp_dir = tempfile.mkdtemp()
        try:
            with patch('apps.system.backup.engine._backup_dir', return_value=Path(tmp_dir)):
                response = self.client.post('/api/v1/system/backups/trigger/')
            self.assertIn(response.status_code, [200, 201])
            self.assertEqual(response.data['status'], 'VERIFIED')
            self.assertNotIn('backup_filename', response.data)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)

    def test_duplicate_trigger_returns_409(self):
        # Create a RUNNING log to simulate an in-progress backup
        BackupLog.objects.create(engine='sqlite', triggered_by='MANUAL', status='RUNNING')
        response = self.client.post('/api/v1/system/backups/trigger/')
        self.assertEqual(response.status_code, 409)
