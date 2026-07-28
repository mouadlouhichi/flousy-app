import PyPDF2
with open("SEO Audit for flousy-app.vercel.app - SEOptimer.pdf", "rb") as f:
    reader = PyPDF2.PdfReader(f)
    text = ""
    for page in reader.pages:
        text += page.extract_text() + "\n"
print(text)
