import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP


def total(values):
    if not isinstance(values, list):
        raise ValueError('Expected an array')
    cents = 0
    for value in values:
        if not isinstance(value, str) or not re.fullmatch(r'-?\d+(?:\.\d+)?', value):
            raise ValueError('Expected a decimal string')
        cents += int((Decimal(value) * 100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))
    return cents


if __name__ == '__main__':
    print(json.dumps(total(json.load(sys.stdin))))
