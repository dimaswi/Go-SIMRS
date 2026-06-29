import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def read_docx(path):
    if not os.path.exists(path):
        return "File not found: " + path
    try:
        with zipfile.ZipFile(path) as docx:
            xml_content = docx.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            paras = []
            for p in tree.findall('.//w:p', ns):
                texts = [node.text for node in p.findall('.//w:t', ns) if node.text]
                if texts:
                    paras.append("".join(texts))
                else:
                    paras.append("")
            return "\n".join(paras)
    except Exception as e:
        return f"Error reading docx: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) > 1:
        print(read_docx(sys.argv[1]))
    else:
        print("Please provide a path to a docx file.")
