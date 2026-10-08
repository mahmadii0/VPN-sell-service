FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY bot.py .
COPY call1.py .
RUN useradd --system --create-home bot
USER bot
CMD ["python", "bot.py"]
