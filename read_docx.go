package main

import (
	"archive/zip"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Harap berikan path ke file DOCX.")
		return
	}
	path := os.Args[1]

	r, err := zip.OpenReader(path)
	if err != nil {
		fmt.Println("Gagal membuka file:", err)
		return
	}
	defer r.Close()

	var docXML io.ReadCloser
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				fmt.Println("Gagal membuka document.xml:", err)
				return
			}
			docXML = rc
			break
		}
	}

	if docXML == nil {
		fmt.Println("File document.xml tidak ditemukan di dalam DOCX.")
		return
	}
	defer docXML.Close()

	decoder := xml.NewDecoder(docXML)
	var inT bool
	var textBuilder strings.Builder
	var output strings.Builder

	for {
		t, err := decoder.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			fmt.Println("Error reading XML:", err)
			return
		}

		switch se := t.(type) {
		case xml.StartElement:
			if se.Name.Local == "t" {
				inT = true
			} else if se.Name.Local == "p" {
				textBuilder.Reset()
			}
		case xml.EndElement:
			if se.Name.Local == "t" {
				inT = false
			} else if se.Name.Local == "p" {
				output.WriteString(textBuilder.String() + "\n")
			}
		case xml.CharData:
			if inT {
				textBuilder.Write(se)
			}
		}
	}

	fmt.Println(output.String())
}
