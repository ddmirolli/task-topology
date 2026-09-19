import importlib.util
import json
import tempfile
import shutil
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


seed = module('seed', ROOT / 'seed/seed.py')
grade = module('grade', ROOT / 'tools/grade.py').grade
reconcile = module('reference', ROOT / 'tools/reference.py').reconcile


class ManagementTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.packet = self.root / 'packet'; self.key = seed.build(self.packet)
        self.submission = self.root / 'submission'; shutil.copytree(self.packet / 'task', self.submission)
        self.solution = reconcile(self.packet / 'task', json.loads((self.packet / 'operator/crm.expected.json').read_text()))
        (self.submission / 'REPORT.md').write_text('Reference test report. Clarity review remains pending.')
        self.save()

    def save(self):
        (self.submission / 'findings.json').write_text(json.dumps(self.solution))

    def test_exact_planted_counts_and_no_answer_in_task(self):
        names = ['name_mismatches', 'email_mismatch_ids', 'churned_billed_ids', 'billing_only_ids', 'orphan_refunds', 'unknown_support']
        self.assertEqual([len(self.key[n]) for n in names], [12, 7, 4, 3, 2, 5])
        self.assertFalse(any('key' in p.name or 'expected' in p.name for p in (self.packet / 'task').rglob('*')))
        result = grade(self.packet, self.submission)
        self.assertTrue(result['dataChecksPass']); self.assertIsNone(result['fullPass'])

    def test_same_seed_reproducible_and_changed_seed_varies(self):
        seed.build(self.root / 'same')
        seed.build(self.root / 'different', seed=8)
        read = lambda p: json.loads((self.root / p / 'manifest.json').read_text())
        self.assertEqual(read('same'), read('packet'))
        self.assertNotEqual(read('different')['taskHash'], read('packet')['taskHash'])

    def test_alternative_order_passes(self):
        for value in self.solution.values():
            if isinstance(value, list): value.reverse()
        self.save(); self.assertTrue(grade(self.packet, self.submission)['dataChecksPass'])

    def test_missing_duplicate_wrong_amount_and_false_number_fail(self):
        original = json.loads(json.dumps(self.solution))
        for change in [lambda: self.solution['email_mismatch_ids'].pop(),
                       lambda: self.solution['billing_only_ids'].append(self.solution['billing_only_ids'][0]),
                       lambda: self.solution['totals'].update(monthly_billing_cents=1),
                       lambda: self.solution['totals'].update(reconciled_customers=True),
                       lambda: self.solution.update(dates={})]:
            self.solution = json.loads(json.dumps(original)); change(); self.save()
            self.assertFalse(grade(self.packet, self.submission)['dataChecksPass'])

    def test_source_change_and_key_tampering_detected(self):
        (self.submission / 'data/support_tickets.csv').write_bytes(b'changed')
        self.assertFalse(grade(self.packet, self.submission)['dataChecksPass'])
        (self.packet / 'operator/key.json').write_text('{}')
        with self.assertRaises(ValueError): grade(self.packet, self.submission)

    def test_duplicate_json_keys_rejected(self):
        (self.submission / 'findings.json').write_text('{"totals": {}, "totals": {}}')
        with self.assertRaises(ValueError): grade(self.packet, self.submission)


if __name__ == '__main__': unittest.main()
