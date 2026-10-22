FROM public.ecr.aws/docker/library/python:3.12-slim

ARG AWS_REGION
ARG AGENT_MODULE=agents.billing_invoicing_agent

WORKDIR /app

COPY agents/requirements.txt agents/requirements.txt
RUN pip install --no-cache-dir -r agents/requirements.txt \
    && pip install --no-cache-dir "aws-opentelemetry-distro>=0.10.0"

ENV AWS_REGION=${AWS_REGION}
ENV AWS_DEFAULT_REGION=${AWS_REGION}
ENV AGENT_MODULE=${AGENT_MODULE}

# Retained for compatibility with code that may select container host binding.
ENV DOCKER_CONTAINER=1

RUN useradd -m -u 1000 bedrock_agentcore
COPY --chown=bedrock_agentcore:bedrock_agentcore agents /app/agents
# Email templates are imported dynamically by the communication agent.
COPY --chown=bedrock_agentcore:bedrock_agentcore agents/email_templates.py /app/email_templates.py
USER bedrock_agentcore

EXPOSE 8080
EXPOSE 8000

# The build pipeline selects one Python module per image with AGENT_MODULE.
CMD ["sh", "-c", "exec opentelemetry-instrument python -m \"$AGENT_MODULE\""]
