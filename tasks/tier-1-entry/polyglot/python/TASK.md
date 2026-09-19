# Preserve invoice totals

Nobody is available to answer questions. Work only in this workspace. Fix `totals.py`.
The invoice export receives decimal strings. Round each line to cents, half up,
then sum integer cents. Preserve negative credit lines and do not mutate the input.
Read a JSON array from stdin and print one JSON integer. Reject malformed amounts
with a nonzero exit and no total. Do not change this contract. Say DONE when finished.
