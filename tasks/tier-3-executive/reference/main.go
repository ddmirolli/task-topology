package main

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
)

func q(v string) string { return "'" + strings.ReplaceAll(v, "'", "''") + "'" }
func sql(s string) (string, error) {
	c := exec.Command("psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", s)
	b, e := c.Output()
	return strings.TrimSpace(string(b)), e
}
func query(s string) (any, error) {
	b, e := sql(s)
	if e != nil {
		return nil, e
	}
	var v any
	e = json.Unmarshal([]byte(b), &v)
	return v, e
}
func random() string {
	b := make([]byte, 32)
	if _, e := rand.Read(b); e != nil {
		panic(e)
	}
	return hex.EncodeToString(b)
}
func hash(p, s string) string {
	v, e := pbkdf2.Key(sha256.New, p, []byte(s), 600000, 32)
	if e != nil {
		panic(e)
	}
	return hex.EncodeToString(v)
}
func ticket(id string) (any, error) {
	return query("SELECT row_to_json(t) FROM (SELECT id,title,description,status,assignee,COALESCE((SELECT json_agg(c) FROM (SELECT id,body FROM comments WHERE ticket_id=tickets.id ORDER BY id)c),'[]') AS comments FROM tickets WHERE id=" + id + ")t")
}
func respond(w http.ResponseWriter, v any, e error) {
	w.Header().Set("Content-Type", "application/json")
	if e != nil {
		w.WriteHeader(400)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid request"})
		return
	}
	json.NewEncoder(w).Encode(v)
}
func deny(w http.ResponseWriter, code int) { http.Error(w, "denied", code) }
func handler(w http.ResponseWriter, r *http.Request) {
	p := r.URL.Path
	if p == "/" || p == "/ui.js" {
		name := "index.html"
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if p == "/ui.js" {
			name = "ui.js"
			w.Header().Set("Content-Type", "text/javascript")
		}
		data, e := os.ReadFile(name)
		if e != nil {
			http.Error(w, "missing interface", 500)
			return
		}
		w.Write(data)
		return
	}
	if !strings.HasPrefix(p, "/api/") {
		http.NotFound(w, r)
		return
	}
	var b map[string]any
	if r.Method != "GET" {
		if e := json.NewDecoder(io.LimitReader(r.Body, 2_000_000)).Decode(&b); e != nil {
			deny(w, 400)
			return
		}
	}
	text := func(k string) string { v, _ := b[k].(string); return v }
	if p == "/api/signup" && r.Method == "POST" {
		if !strings.Contains(text("email"), "@") || len(text("password")) < 8 {
			deny(w, 400)
			return
		}
		salt := random()
		id, e := sql("INSERT INTO users(email,salt,password_hash) VALUES (" + q(text("email")) + "," + q(salt) + "," + q(hash(text("password"), salt)) + ") RETURNING id")
		n, _ := strconv.Atoi(id)
		respond(w, map[string]int{"id": n}, e)
		return
	}
	if p == "/api/login" && r.Method == "POST" {
		s, e := sql("SELECT row_to_json(u) FROM (SELECT id,salt,password_hash FROM users WHERE email=" + q(text("email")) + ")u")
		var u struct {
			ID            int
			Salt          string
			Password_hash string
		}
		json.Unmarshal([]byte(s), &u)
		if e != nil || u.ID == 0 || subtle.ConstantTimeCompare([]byte(hash(text("password"), u.Salt)), []byte(u.Password_hash)) != 1 {
			deny(w, 401)
			return
		}
		token := random()
		_, e = sql("INSERT INTO sessions VALUES (" + q(token) + "," + strconv.Itoa(u.ID) + ")")
		http.SetCookie(w, &http.Cookie{Name: "session", Value: token, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode})
		respond(w, map[string]int{"id": u.ID}, e)
		return
	}
	cookie, e := r.Cookie("session")
	if e != nil {
		deny(w, 401)
		return
	}
	uid, e := sql("SELECT user_id FROM sessions WHERE token=" + q(cookie.Value))
	if e != nil || uid == "" {
		deny(w, 401)
		return
	}
	if p == "/api/logout" && r.Method == "POST" {
		_, e = sql("DELETE FROM sessions WHERE token=" + q(cookie.Value))
		http.SetCookie(w, &http.Cookie{Name: "session", Value: "", Path: "/", MaxAge: -1})
		respond(w, map[string]string{}, e)
		return
	}
	if p == "/api/users" && r.Method == "GET" {
		v, e := query("SELECT COALESCE(json_agg(u),'[]') FROM (SELECT id,email FROM users ORDER BY id)u")
		respond(w, v, e)
		return
	}
	if strings.HasPrefix(p, "/api/users/") && r.Method == "PATCH" {
		id := strings.TrimPrefix(p, "/api/users/")
		if id != uid {
			deny(w, 403)
			return
		}
		if !strings.Contains(text("email"), "@") {
			deny(w, 400)
			return
		}
		v, e := query("WITH changed AS (UPDATE users SET email=" + q(text("email")) + " WHERE id=" + uid + " RETURNING id,email) SELECT row_to_json(changed) FROM changed")
		respond(w, v, e)
		return
	}
	if p == "/api/import" && r.Method == "POST" {
		c := exec.Command("python3", "import.py")
		c.Stdin = strings.NewReader(text("csv"))
		out, e := c.Output()
		var v any
		if e == nil {
			e = json.Unmarshal(out, &v)
		}
		respond(w, v, e)
		return
	}
	if p == "/api/tickets" && r.Method == "POST" {
		if strings.TrimSpace(text("title")) == "" {
			deny(w, 400)
			return
		}
		id, e := sql("INSERT INTO tickets(title,description) VALUES (" + q(text("title")) + "," + q(text("description")) + ") RETURNING id")
		if e != nil {
			respond(w, nil, e)
			return
		}
		v, e := ticket(id)
		respond(w, v, e)
		return
	}
	if p == "/api/tickets" && r.Method == "GET" {
		term := q("%" + r.URL.Query().Get("q") + "%")
		v, e := query("SELECT COALESCE(json_agg(t),'[]') FROM (SELECT id,title,description,status,assignee FROM tickets WHERE title ILIKE " + term + " OR id IN (SELECT ticket_id FROM comments WHERE body ILIKE " + term + ") ORDER BY id)t")
		respond(w, v, e)
		return
	}
	if strings.HasPrefix(p, "/api/tickets/") {
		parts := strings.Split(strings.TrimPrefix(p, "/api/tickets/"), "/")
		n, e := strconv.ParseInt(parts[0], 10, 64)
		if e != nil || n < 1 {
			deny(w, 400)
			return
		}
		id := strconv.FormatInt(n, 10)
		if len(parts) == 2 && parts[1] == "comments" && r.Method == "POST" {
			if text("body") == "" {
				deny(w, 400)
				return
			}
			v, e := query("WITH c AS (INSERT INTO comments(ticket_id,body) VALUES (" + id + "," + q(text("body")) + ") RETURNING id,body) SELECT row_to_json(c) FROM c")
			respond(w, v, e)
			return
		}
		if len(parts) != 1 {
			http.NotFound(w, r)
			return
		}
		if r.Method == "PATCH" {
			sets := []string{}
			if _, ok := b["title"]; ok {
				if strings.TrimSpace(text("title")) == "" {
					deny(w, 400)
					return
				}
				sets = append(sets, "title="+q(text("title")))
			}
			if a, ok := b["assignee"]; ok {
				v, ok := a.(float64)
				if !ok || v != float64(int64(v)) {
					deny(w, 400)
					return
				}
				sets = append(sets, "assignee="+strconv.FormatInt(int64(v), 10))
			}
			if _, ok := b["status"]; ok {
				s := text("status")
				if s != "open" && s != "in_progress" && s != "done" {
					deny(w, 400)
					return
				}
				sets = append(sets, "status="+q(s))
			}
			if len(sets) == 0 {
				deny(w, 400)
				return
			}
			_, e = sql("UPDATE tickets SET " + strings.Join(sets, ",") + " WHERE id=" + id)
			if e != nil {
				respond(w, nil, e)
				return
			}
		}
		if r.Method == "GET" || r.Method == "PATCH" {
			v, e := ticket(id)
			respond(w, v, e)
			return
		}
	}
	http.NotFound(w, r)
}
func main() {
	if e := http.ListenAndServe("127.0.0.1:"+os.Getenv("PORT"), http.HandlerFunc(handler)); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
