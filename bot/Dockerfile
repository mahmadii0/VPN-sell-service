FROM python:3.12-slim
WORKDIR /app
RUN useradd --system --create-home bot
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/downloads && chown -R bot:bot /app

USER bot
CMD ["python", "bot.py"]
