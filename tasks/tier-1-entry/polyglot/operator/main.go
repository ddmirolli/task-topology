package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

func run() error {
	var v struct{ Due, Now, Zone string }
	if e := json.NewDecoder(os.Stdin).Decode(&v); e != nil {
		return e
	}
	d, e := time.Parse("2006-01-02", v.Due)
	if e != nil {
		return e
	}
	n, e := time.Parse(time.RFC3339, v.Now)
	if e != nil {
		return e
	}
	z, e := time.LoadLocation(v.Zone)
	if e != nil {
		return e
	}
	today := n.In(z).Format("2006-01-02")
	return json.NewEncoder(os.Stdout).Encode(d.Format("2006-01-02") < today)
}
func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
