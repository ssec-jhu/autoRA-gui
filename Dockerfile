FROM python:3.11-slim

WORKDIR /app

COPY requirements/prd.txt requirements.txt

RUN pip3 install -r requirements.txt

COPY . .

CMD ["uvicorn", "autora_gui.react_app.server:app", "--host", "0.0.0.0", "--port", "8000"]
