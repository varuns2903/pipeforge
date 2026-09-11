#!/bin/sh
# Alertmanager's config file has no native env-var substitution, so this
# renders alertmanager.yml's __PLACEHOLDER__ tokens from environment
# variables before starting the real binary. Precedence when both are set:
# Slack wins (it's the more common choice for team alerting); if neither is
# configured, alerts route to a no-op receiver rather than failing to start.
set -e

CONFIG_SRC=/etc/alertmanager/alertmanager.yml
CONFIG_OUT=/tmp/alertmanager.yml

RECEIVER=blackhole
if [ -n "$SLACK_ALERT_WEBHOOK_URL" ]; then
  RECEIVER=slack
elif [ -n "$ALERT_EMAIL_TO" ]; then
  RECEIVER=email
fi

# Alertmanager validates every receiver's config at load time, even ones no
# route ever points at — so unused placeholders still need to be
# syntactically valid (a well-formed URL, a non-empty "to" address), not
# just non-empty strings, or the whole process refuses to start.
sed \
  -e "s|__DEFAULT_RECEIVER__|$RECEIVER|g" \
  -e "s|__SLACK_WEBHOOK_URL__|${SLACK_ALERT_WEBHOOK_URL:-https://unset.invalid/}|g" \
  -e "s|__ALERT_EMAIL_TO__|${ALERT_EMAIL_TO:-unset@unset.invalid}|g" \
  -e "s|__SMTP_FROM__|${MAIL_FROM:-PipeForge <no-reply@pipeforge.local>}|g" \
  -e "s|__SMTP_HOST__|${SMTP_HOST:-unset.invalid}|g" \
  -e "s|__SMTP_PORT__|${SMTP_PORT:-587}|g" \
  -e "s|__SMTP_USER__|${SMTP_USER:-unset}|g" \
  -e "s|__SMTP_PASS__|${SMTP_PASS:-unset}|g" \
  "$CONFIG_SRC" > "$CONFIG_OUT"

exec /bin/alertmanager --config.file="$CONFIG_OUT" --storage.path=/alertmanager "$@"
