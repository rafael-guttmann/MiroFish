FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/requirements.txt server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY charters charters
COPY firms firms
COPY ui-prototype ui-prototype
COPY server server
ENV HOLDINGS_HOST=0.0.0.0 HOLDINGS_RUNNER=sdk HOLDINGS_DATA=/data
WORKDIR /app/server
CMD ["python3", "app.py"]
