#!/bin/sh
set -eu
psql -X -q -v ON_ERROR_STOP=1 -f schema.sql
exec ./server
