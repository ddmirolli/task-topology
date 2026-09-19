package main

import (
	"encoding/json"
	"os"
	"time"
)

func main() {
	var v struct{ Due, Now, Zone string }
	json.NewDecoder(os.Stdin).Decode(&v)
	d, _ := time.Parse("2006-01-02", v.Due)
	n, _ := time.Parse(time.RFC3339, v.Now)
	json.NewEncoder(os.Stdout).Encode(d.Before(n))
}
