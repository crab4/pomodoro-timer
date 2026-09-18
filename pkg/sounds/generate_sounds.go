package sounds

import (
	"bytes"
	"encoding/binary"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"time"
)

const (
	sampleRate     = 44100
	numChannels    = 2
	bitsPerSample  = 16
	bytesPerSample = 2
)

type Note struct {
	Freq float64 //hz
	Dur  time.Duration
}

func CheckAndGenerate(dir string) error {

	workEnd := []Note{
		{Freq: 523.25, Dur: 150 * time.Millisecond},
		{Freq: 659.25, Dur: 150 * time.Millisecond},
		{Freq: 783.99, Dur: 300 * time.Millisecond},
	}

	breakEnd := []Note{
		{Freq: 880.00, Dur: 100 * time.Millisecond},
		{Freq: 659.25, Dur: 150 * time.Millisecond},
	}

	longBreakEnd := []Note{
		{Freq: 783.99, Dur: 200 * time.Millisecond},
		{Freq: 659.25, Dur: 200 * time.Millisecond},
		{Freq: 523.25, Dur: 200 * time.Millisecond},
		{Freq: 392.00, Dur: 400 * time.Millisecond},
	}

	files := []struct {
		name  string
		notes []Note
	}{
		{"work_end.wav", workEnd},
		{"break_end.wav", breakEnd},
		{"long_break_end.wav", longBreakEnd},
	}

	for _, f := range files {
		pathSave := filepath.Join(dir, f.name)

		// Если файл уже существует — пропускаем.
		if _, err := os.Stat(pathSave); err == nil {
			continue
		} else if !os.IsNotExist(err) {
			return fmt.Errorf("проверка %q: %w", pathSave, err)
		}

		if err := writeWAV(pathSave, synth(f.notes)); err != nil {
			return fmt.Errorf("запись %q: %w", pathSave, err)
		}
	}

	return nil
}

// synth превращает список нот в PCM-буфер (int16 LE, стерео).
func synth(notes []Note) []byte {
	var buf bytes.Buffer
	const attack = 0.005 // сек, плавное начало
	const release = 0.05 // сек, плавный хвост — убирают щелчки
	const volume = 0.3   // <1.0, чтобы не клиппило

	for _, n := range notes {
		dur := n.Dur.Seconds()
		count := int(float64(sampleRate) * dur)
		for i := 0; i < count; i++ {
			t := float64(i) / float64(sampleRate)

			env := 1.0
			if t < attack {
				env = t / attack
			} else if t > dur-release {
				env = (dur - t) / release
				if env < 0 {
					env = 0
				}
			}

			var v float64
			if n.Freq > 0 {
				v = math.Sin(2*math.Pi*n.Freq*t) * env * volume
			}
			s := int16(v * math.MaxInt16)

			var b [2]byte
			binary.LittleEndian.PutUint16(b[:], uint16(s))
			for c := 0; c < numChannels; c++ {
				buf.Write(b[:])
			}
		}
	}
	return buf.Bytes()
}

// writeWAV пишет PCM-данные в WAV-файл (формат PCM, 16-bit LE).
func writeWAV(path string, pcm []byte) error {
	var buf bytes.Buffer

	byteRate := sampleRate * numChannels * bytesPerSample
	blockAlign := numChannels * bytesPerSample
	dataSize := uint32(len(pcm))
	riffSize := 36 + dataSize

	// RIFF header
	buf.WriteString("RIFF")
	binary.Write(&buf, binary.LittleEndian, riffSize)
	buf.WriteString("WAVE")

	// fmt chunk
	buf.WriteString("fmt ")
	binary.Write(&buf, binary.LittleEndian, uint32(16))            // размер fmt-чанка
	binary.Write(&buf, binary.LittleEndian, uint16(1))             // PCM
	binary.Write(&buf, binary.LittleEndian, uint16(numChannels))   // каналы
	binary.Write(&buf, binary.LittleEndian, uint32(sampleRate))    // частота дискретизации
	binary.Write(&buf, binary.LittleEndian, uint32(byteRate))      // байт/сек
	binary.Write(&buf, binary.LittleEndian, uint16(blockAlign))    // выравнивание блока
	binary.Write(&buf, binary.LittleEndian, uint16(bitsPerSample)) // бит на семпл

	// data chunk
	buf.WriteString("data")
	binary.Write(&buf, binary.LittleEndian, dataSize)
	buf.Write(pcm)

	return os.WriteFile(path, buf.Bytes(), 0o644)
}
