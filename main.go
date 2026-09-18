package main

import (
	"fmt"
	"log"
	"net/http"
	"path/filepath"
	"pomodoro-server/pkg/sounds"
)

const addr = 8080

func main() {
	soundsDir := filepath.Join("static", "sounds")
	err := sounds.CheckAndGenerate(soundsDir)
	if err != nil {
		log.Fatalf("произошла ошибка при генерации файлов %v", err)
	}

	fs := http.FileServer(http.Dir("static"))
	http.Handle("/", fs)

	if err := http.ListenAndServe(fmt.Sprintf(":%d", addr), nil); err != nil {
		log.Fatal(err)
	}
}
