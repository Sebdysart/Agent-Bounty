#!/bin/bash
# secrets.sh - Manage Fly.io secrets for Agent-Bounty

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
ACTION=""

# Required secrets for the application
REQUIRED_SECRETS=(
    "DATABASE_URL"
    "SESSION_SECRET"
    "CREDENTIAL_ENCRYPTION_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_PUBLISHABLE_KEY"
    "STRIPE_WEBHOOK_SECRET"
    "OPENAI_API_KEY"
)

# Optional secrets
OPTIONAL_SECRETS=(
    "ADMIN_USER_IDS"
    "ANTHROPIC_API_KEY"
    "GROQ_API_KEY"
    "JWT_SECRET"
    "GITHUB_TOKEN"
    "SLACK_WEBHOOK_URL"
    "SENDGRID_API_KEY"
    "R2_ACCOUNT_ID"
    "R2_ACCESS_KEY_ID"
    "R2_SECRET_ACCESS_KEY"
    "R2_BUCKET_NAME"
    "UPSTASH_REDIS_REST_URL"
    "UPSTASH_REDIS_REST_TOKEN"
    "UPSTASH_KAFKA_REST_URL"
    "UPSTASH_KAFKA_REST_USERNAME"
    "UPSTASH_KAFKA_REST_PASSWORD"
)

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --staging)
            ENVIRONMENT="staging"
            shift
            ;;
        --production)
            ENVIRONMENT="production"
            shift
            ;;
        list)
            ACTION="list"
            shift
            ;;
        set)
            ACTION="set"
            shift
            ;;
        set-from-env)
            ACTION="set-from-env"
            shift
            ;;
        unset)
            ACTION="unset"
            SECRET_NAME="$2"
            shift 2
            ;;
        check)
            ACTION="check"
            shift
            ;;
        --help)
            echo "Usage: ./scripts/secrets.sh [options] <action>"
            echo ""
            echo "Actions:"
            echo "  list           List all secrets (names only)"
            echo "  set            Interactively set required secrets"
            echo "  set-from-env   Set secrets from local .env file"
            echo "  unset <name>   Remove a specific secret"
            echo "  check          Check if all required secrets are set"
            echo ""
            echo "Options:"
            echo "  --staging      Target staging environment"
            echo "  --production   Target production environment (default)"
            echo "  --help         Show this help message"
            echo ""
            echo "Required secrets:"
            for secret in "${REQUIRED_SECRETS[@]}"; do
                echo "  - $secret"
            done
            echo ""
            echo "Optional secrets:"
            for secret in "${OPTIONAL_SECRETS[@]}"; do
                echo "  - $secret"
            done
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option or action: $1${NC}"
            echo "Run './scripts/secrets.sh --help' for usage"
            exit 1
            ;;
    esac
done

# Determine app name
if [ "$ENVIRONMENT" = "staging" ]; then
    APP_NAME="agent-bounty-staging"
else
    APP_NAME="agent-bounty"
fi

echo -e "${GREEN}=== Agent-Bounty Secrets Manager ===${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"
echo -e "App: ${YELLOW}${APP_NAME}${NC}"
echo ""

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo -e "${RED}Error: fly CLI is not installed${NC}"
    echo "Install it from: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if logged in to Fly.io
if ! fly auth whoami &> /dev/null; then
    echo -e "${RED}Error: Not logged in to Fly.io${NC}"
    echo "Run: fly auth login"
    exit 1
fi

# Action: list
if [ "$ACTION" = "list" ]; then
    echo -e "${GREEN}Current secrets for ${APP_NAME}:${NC}"
    fly secrets list --app "$APP_NAME"
    exit 0
fi

# Action: check
if [ "$ACTION" = "check" ]; then
    echo -e "${GREEN}Checking required secrets...${NC}"
    EXISTING_SECRETS=$(fly secrets list --app "$APP_NAME" 2>/dev/null | tail -n +2 | awk '{print $1}')
    MISSING=()

    for secret in "${REQUIRED_SECRETS[@]}"; do
        if echo "$EXISTING_SECRETS" | grep -q "^${secret}$"; then
            echo -e "  ${GREEN}✓${NC} $secret"
        else
            echo -e "  ${RED}✗${NC} $secret (missing)"
            MISSING+=("$secret")
        fi
    done

    echo ""
    echo -e "${CYAN}Checking optional secrets...${NC}"
    for secret in "${OPTIONAL_SECRETS[@]}"; do
        if echo "$EXISTING_SECRETS" | grep -q "^${secret}$"; then
            echo -e "  ${GREEN}✓${NC} $secret"
        else
            echo -e "  ${YELLOW}○${NC} $secret (not set)"
        fi
    done

    echo ""
    if [ ${#MISSING[@]} -eq 0 ]; then
        echo -e "${GREEN}All required secrets are set!${NC}"
        exit 0
    else
        echo -e "${RED}Missing ${#MISSING[@]} required secret(s): ${MISSING[*]}${NC}"
        exit 1
    fi
fi

# Action: set (interactive)
if [ "$ACTION" = "set" ]; then
    echo -e "${GREEN}Setting secrets interactively...${NC}"
    echo -e "${YELLOW}Press Enter to skip a secret (keep existing value)${NC}"
    echo ""

    SECRETS_TO_SET=""

    for secret in "${REQUIRED_SECRETS[@]}"; do
        read -p "Enter $secret: " -s value
        echo ""
        if [ -n "$value" ]; then
            SECRETS_TO_SET="$SECRETS_TO_SET $secret=$value"
        fi
    done

    echo ""
    read -p "Set optional secrets too? (y/N): " set_optional
    if [[ "$set_optional" =~ ^[Yy]$ ]]; then
        for secret in "${OPTIONAL_SECRETS[@]}"; do
            read -p "Enter $secret: " -s value
            echo ""
            if [ -n "$value" ]; then
                SECRETS_TO_SET="$SECRETS_TO_SET $secret=$value"
            fi
        done
    fi

    if [ -n "$SECRETS_TO_SET" ]; then
        echo -e "\n${GREEN}Setting secrets...${NC}"
        fly secrets set --app "$APP_NAME" $SECRETS_TO_SET
        echo -e "${GREEN}Secrets updated successfully!${NC}"
    else
        echo -e "${YELLOW}No secrets to set.${NC}"
    fi
    exit 0
fi

# Action: set-from-env
if [ "$ACTION" = "set-from-env" ]; then
    if [ ! -f ".env" ]; then
        echo -e "${RED}Error: .env file not found${NC}"
        echo "Create a .env file with your secrets first"
        exit 1
    fi

    echo -e "${GREEN}Reading secrets from .env file...${NC}"
    SECRETS_TO_SET=""

    # Read all secrets from .env
    ALL_SECRETS=("${REQUIRED_SECRETS[@]}" "${OPTIONAL_SECRETS[@]}")

    for secret in "${ALL_SECRETS[@]}"; do
        value=$(grep "^${secret}=" .env 2>/dev/null | cut -d'=' -f2- | sed 's/^"//' | sed 's/"$//')
        if [ -n "$value" ] && [ "$value" != "your-"* ] && [ "$value" != "sk_test_"* ]; then
            echo -e "  ${GREEN}✓${NC} Found $secret"
            SECRETS_TO_SET="$SECRETS_TO_SET $secret=$value"
        else
            echo -e "  ${YELLOW}○${NC} Skipping $secret (not set or placeholder)"
        fi
    done

    if [ -n "$SECRETS_TO_SET" ]; then
        echo ""
        read -p "Set these secrets on ${APP_NAME}? (y/N): " confirm
        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            echo -e "\n${GREEN}Setting secrets...${NC}"
            fly secrets set --app "$APP_NAME" $SECRETS_TO_SET
            echo -e "${GREEN}Secrets updated successfully!${NC}"
        else
            echo -e "${YELLOW}Aborted.${NC}"
        fi
    else
        echo -e "${YELLOW}No valid secrets found in .env${NC}"
    fi
    exit 0
fi

# Action: unset
if [ "$ACTION" = "unset" ]; then
    if [ -z "$SECRET_NAME" ]; then
        echo -e "${RED}Error: Secret name required${NC}"
        echo "Usage: ./scripts/secrets.sh unset <secret-name>"
        exit 1
    fi

    echo -e "${YELLOW}Removing secret: ${SECRET_NAME}${NC}"
    read -p "Are you sure? (y/N): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        fly secrets unset --app "$APP_NAME" "$SECRET_NAME"
        echo -e "${GREEN}Secret removed successfully!${NC}"
    else
        echo -e "${YELLOW}Aborted.${NC}"
    fi
    exit 0
fi

# No action specified
echo -e "${YELLOW}No action specified.${NC}"
echo "Run './scripts/secrets.sh --help' for usage"
exit 1
