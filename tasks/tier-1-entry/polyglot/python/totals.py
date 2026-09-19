import json
import sys


def total(values):
    return round(sum(float(value) for value in values) * 100)


if __name__ == '__main__':
    print(json.dumps(total(json.load(sys.stdin))))
