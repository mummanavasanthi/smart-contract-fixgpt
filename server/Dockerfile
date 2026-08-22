FROM node:22-bookworm

# Install Python and tools needed by Slither
RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv curl git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node dependencies first
COPY package*.json ./
RUN npm install --omit=dev

# Install Slither
RUN python3 -m venv /opt/slither-venv && \
    /opt/slither-venv/bin/pip install --upgrade pip && \
    /opt/slither-venv/bin/pip install slither-analyzer

# Install Solidity compiler
RUN curl -L \
    https://github.com/ethereum/solidity/releases/download/v0.8.20/solc-static-linux \
    -o /usr/local/bin/solc && \
    chmod +x /usr/local/bin/solc

# Copy backend
COPY . .

ENV PORT=5000

EXPOSE 5000

CMD ["node", "server.js"]