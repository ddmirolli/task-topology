import unittest
from intelligence import normalize

HEADER = 'Model,Display name,eci,eci_ci_low,eci_ci_high,date,Organization,model_versions\n'

class IntelligenceTests(unittest.TestCase):
    def test_preserves_names_versions_and_missing_intervals(self):
        rows = normalize((HEADER + 'Model X,X,150,,,2026-09-01,Lab,version-id\n').encode())
        self.assertEqual(rows[0]['score'], 150)
        self.assertIsNone(rows[0]['low']); self.assertEqual(rows[0]['sourceVersions'], 'version-id')
        self.assertNotIn('modelId', rows[0])

    def test_rejects_silent_schema_change_duplicate_names_and_nonfinite_values(self):
        for raw in ['name,score\nX,150\n', HEADER,
                    HEADER + 'X,X,150,140,160,,Lab,\nX,X,150,140,160,,Lab,\n',
                    HEADER + 'X,X,NaN,140,160,,Lab,\n',
                    HEADER + 'X,X,150,160,170,,Lab,\n']:
            with self.assertRaises(ValueError): normalize(raw.encode())

if __name__ == '__main__': unittest.main()
