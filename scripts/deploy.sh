#!/bin/bash
# deploy.sh - Deployment script for Agent-Bounty on Fly.io

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="production"
SKIP_TESTS=false
SKIP_BUILD=false

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
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --help)
            echo "Usage: ./scripts/deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  --staging      Deploy to staging environment"
            echo "  --production   Deploy to production environment (default)"
            echo "  --skip-tests   Skip running tests before deployment"
            echo "  --skip-build   Skip local build check"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

echo -e "${GREEN}=== Agent-Bounty Deployment ===${NC}"
echo -e "Environment: ${YELLOW}${ENVIRONMENT}${NC}"

# Determine config file
if [ "$ENVIRONMENT" = "staging" ]; then
    CONFIG_FILE="fly.staging.toml"
    APP_NAME="agent-bounty-staging"
else
    CONFIG_FILE="fly.toml"
    APP_NAME="agent-bounty"
fi

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error: Config file $CONFIG_FILE not found${NC}"
    exit 1
fi

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

# Run tests unless skipped
if [ "$SKIP_TESTS" = false ]; then
    echo -e "\n${GREEN}Running tests...${NC}"
    npm test
    if [ $? -ne 0 ]; then
        echo -e "${RED}Tests failed. Aborting deployment.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Tests passed!${NC}"
fi

# Run build check unless skipped
if [ "$SKIP_BUILD" = false ]; then
    echo -e "\n${GREEN}Running build check...${NC}"
    npm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}Build failed. Aborting deployment.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Build successful!${NC}"
fi

# Deploy to Fly.io
echo -e "\n${GREEN}Deploying to Fly.io (${APP_NAME})...${NC}"
fly deploy --config "$CONFIG_FILE" --app "$APP_NAME"

if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}=== Deployment successful! ===${NC}"
    echo -e "App: ${YELLOW}${APP_NAME}${NC}"

    # Show app URL
    if [ "$ENVIRONMENT" = "staging" ]; then
        echo -e "URL: ${YELLOW}https://agent-bounty-staging.fly.dev${NC}"
    else
        echo -e "URL: ${YELLOW}https://agent-bounty.fly.dev${NC}"
    fi

    # Show status
    echo -e "\n${GREEN}Checking deployment status...${NC}"
    fly status --config "$CONFIG_FILE" --app "$APP_NAME"
else
    echo -e "${RED}Deployment failed!${NC}"
    exit 1
fi
