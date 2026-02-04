#!/bin/bash
#
# export MICROFAB_CONFIG=$(cat MICROFAB.txt)
# docker run --name microfab -e MICROFAB_CONFIG -p 9090:9090 ibmcom/ibp-microfab
#
# Installing Connection Profiles: curl -s http://console.127-0-0-1.nip.io:9090/ak/api/v1/components | weft microfab -w ./_wallets -p ./_gateways -m ./_msp -f
# Installing Binaries: curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary
# =============================================================================
# Chaincode Deployment Script for Crowdfunding Platform v2
# Single Channel + Combined Chaincode + Private Data Collections
# =============================================================================
#
# FEATURES:
# ---------
# 1. Combined Chaincode Package
#    - All 5 contracts in single package: Startup, Investor, Validator, Platform, Token
#    - Single chaincode name: "crowdfunding"
#    - Single channel: "crowdfunding-channel"
#    - Private Data Collections (PDC) support with collections_config.json
#
# 2. Organization Context Switching
#    - switch_to_startup/validator/platform/investor functions
#    - Automatically exports CORE_PEER_LOCALMSPID, CORE_PEER_MSPCONFIGPATH, CORE_PEER_ADDRESS
#    - Sets up PATH and FABRIC_CFG_PATH after each org switch
#
# 3. Chaincode Packaging with Auto-Versioning
#    - package_chaincode function with auto-incrementing version
#    - Detects existing .tar.gz files and increments version
#    - Packages entire contracts/ directory including all .go files
#
# 4. Installation on All Organizations
#    - install_on_all_orgs: Installs on all 4 organizations
#    - Automatically captures and exports PACKAGE_ID
#
# 5. Approval with Private Data Collections
#    - approve_for_org: Approves with --collections-config flag (MANDATORY for PDC)
#    - Auto-detects current sequence and increments
#    - approve_on_all_orgs: Approves from all 4 organizations
#
# 6. Commit with Endorsement Policy
#    - Commits with proper endorsement policy requiring all 4 orgs
#    - Includes collections-config.json during commit
#
# 7. Smart Upgrade Mechanism
#    - Auto-detects committed version and sequence
#    - Increments and upgrades across all organizations
#
# GLOBAL VARIABLES:
# -----------------
#   MSP_BASE_PATH       - Base path for MSP configs (/home/kajal/crowdfunding/_msp)
#   CONTRACTS_PATH      - Path to combined contracts directory (./contracts)
#   ORDERER_URL         - Orderer API URL
#   CHANNEL_NAME        - Single channel name (crowdfunding-channel)
#   CHAINCODE_NAME      - Single chaincode name (crowdfunding)
#   COLLECTIONS_CONFIG  - Path to collections_config.json
#
# =============================================================================
# AVAILABLE COMMANDS:
# =============================================================================
#
# PACKAGING COMMANDS:
#   source ./deploy_chaincode.sh package                    - Package combined chaincode (auto-version)
#
# INSTALLATION COMMANDS:
#   source ./deploy_chaincode.sh install                    - Install on all 4 organizations
#
# DEPLOYMENT COMMANDS (Initial):
#   source ./deploy_chaincode.sh deploy                     - Full deployment: approve on all orgs + commit
#
# UPGRADE COMMANDS:
#   source ./deploy_chaincode.sh upgrade                    - Upgrade chaincode on all orgs
#
# QUERY & CHECK COMMANDS:
#   source ./deploy_chaincode.sh query-committed            - Query committed chaincode details
#   source ./deploy_chaincode.sh check-readiness            - Check if chaincode ready to commit
#   source ./deploy_chaincode.sh query-installed <org>      - Query installed chaincodes on specific org
#
# UTILITY COMMANDS:
#   source ./deploy_chaincode.sh switch <org>               - Switch peer context to specific org
#          source ./deploy_chaincode.sh switch startup
#          source ./deploy_chaincode.sh switch investor   
#          source ./deploy_chaincode.sh switch validator
#          source ./deploy_chaincode.sh switch platform 
#   source ./deploy_chaincode.sh help                       - Show detailed usage information
#
# =============================================================================
# DEPLOYMENT FLOW - INITIAL DEPLOYMENT:
# =============================================================================
#
# STEP 1: Package Combined Chaincode
#   Command: source ./deploy_chaincode.sh package
#   Output:  Creates crowdfunding_1.tar.gz with ALL contract files
#            Files included: main.go, startuporg_contract.go, investororg_contract.go,
#                           validatororg_contract.go, platformorg_contract.go,
#                           token_operations.go, go.mod, go.sum, vendor/
#
# STEP 2: Install on All Organizations
#   Command: source ./deploy_chaincode.sh install
#   Output:  Installs on StartupOrg, InvestorOrg, ValidatorOrg, PlatformOrg
#            Auto-exports: PACKAGE_ID=crowdfunding_1:abc123...
#
# STEP 3: Deploy (Approve + Commit)
#   Command: source ./deploy_chaincode.sh deploy
#   Output:  Approves from all 4 orgs with collections_config.json
#            Commits to crowdfunding-channel
#
# STEP 4: Test Chaincode
#   Invoke: peer chaincode invoke -C crowdfunding-channel -n crowdfunding \
#           -c '{"function":"StartupContract:CreateCampaign","Args":[...]}'
#   Query:  peer chaincode query -C crowdfunding-channel -n crowdfunding \
#           -c '{"function":"InvestorContract:GetCampaign","Args":["CAMP001"]}'
#
# =============================================================================
# UPGRADE FLOW:
# =============================================================================
#
# STEP 1: Make code changes in contracts/
# STEP 2: Package new version
#   Command: source ./deploy_chaincode.sh package
#   Output:  Creates crowdfunding_2.tar.gz (auto-incremented)
#
# STEP 3: Install new version
#   Command: source ./deploy_chaincode.sh install
#   Output:  Installs on all 4 orgs, exports new PACKAGE_ID
#
# STEP 4: Upgrade
#   Command: source ./deploy_chaincode.sh upgrade
#   Output:  Approves from all 4 orgs (sequence: 2)
#            Commits upgrade to channel
#
# =============================================================================

# Disable exit on error for better error handling
# set -e

# =============================================================================
# Global Configuration Variables
# =============================================================================
ORDERER_URL="orderer-api.127-0-0-1.nip.io:9090"
MSP_BASE_PATH="/home/kajal/crowdfunding/crowdfundingv2/_msp"  #change the path according to your device
CONTRACTS_PATH="./contracts"
CHANNEL_NAME="crowdfunding-channel"
CHAINCODE_NAME="crowdfunding"
COLLECTIONS_CONFIG="./collections_config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}============================================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}============================================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

setup_fabric_env() {
    export PATH=$PATH:${PWD}/bin
    export FABRIC_CFG_PATH=${PWD}/config
}

# =============================================================================
# Organization Context Switching Functions
# =============================================================================

switch_to_startup() {
    print_info "Switching to StartupOrg..."
    export CORE_PEER_LOCALMSPID=StartupOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/StartupOrg/startuporgadmin/msp
    export CORE_PEER_ADDRESS=startuporgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    print_success "Now operating as StartupOrg (startuporgpeer-api.127-0-0-1.nip.io:9090)"
}

switch_to_validator() {
    print_info "Switching to ValidatorOrg..."
    export CORE_PEER_LOCALMSPID=ValidatorOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/ValidatorOrg/validatororgadmin/msp
    export CORE_PEER_ADDRESS=validatororgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    print_success "Now operating as ValidatorOrg (validatororgpeer-api.127-0-0-1.nip.io:9090)"
}

switch_to_investor() {
    print_info "Switching to InvestorOrg..."
    export CORE_PEER_LOCALMSPID=InvestorOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/InvestorOrg/investororgadmin/msp
    export CORE_PEER_ADDRESS=investororgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    print_success "Now operating as InvestorOrg (investororgpeer-api.127-0-0-1.nip.io:9090)"
}

switch_to_platform() {
    print_info "Switching to PlatformOrg..."
    export CORE_PEER_LOCALMSPID=PlatformOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/PlatformOrg/platformorgadmin/msp
    export CORE_PEER_ADDRESS=platformorgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    print_success "Now operating as PlatformOrg (platformorgpeer-api.127-0-0-1.nip.io:9090)"
}

# =============================================================================
# Chaincode Packaging Function
# =============================================================================

package_chaincode() {
    print_header "📦 Packaging Combined Chaincode"
    
    # Setup Fabric environment
    setup_fabric_env
    
    # Navigate to crowdfundingv2 directory
    cd "${HOME}/crowdfunding/crowdfundingv2"
    
    # Check if contracts directory exists
    if [ ! -d "${CONTRACTS_PATH}" ]; then
        print_error "Contracts directory not found: ${CONTRACTS_PATH}"
        return 1
    fi
    
    # Navigate to contracts directory
    cd "${CONTRACTS_PATH}"
    
    # Run go mod tidy
    print_info "Running go mod tidy..."
    go mod tidy
    
    print_info "Running go mod vendor..."
    go mod vendor
    
    # Navigate back to crowdfundingv2
    cd "${HOME}/crowdfunding/crowdfundingv2"
    
    # Detect current version from existing packages
    latest_version=0
    for file in ${CHAINCODE_NAME}_*.tar.gz; do
        if [ -f "$file" ]; then
            version=$(echo "$file" | sed -n "s/${CHAINCODE_NAME}_\([0-9]*\).tar.gz/\1/p")
            if [ "$version" -gt "$latest_version" ]; then
                latest_version=$version
            fi
        fi
    done
    
    new_version=$((latest_version + 1))
    package_label="${CHAINCODE_NAME}_${new_version}"
    package_file="${package_label}.tar.gz"
    
    print_info "Current version: ${latest_version}"
    print_info "New version: ${new_version}"
    print_info "Package label: ${package_label}"
    print_info "Package file: ${package_file}"
    
    # Package the chaincode
    print_info "Packaging chaincode from ${CONTRACTS_PATH}..."
    peer lifecycle chaincode package "${package_file}" \
        --path "${CONTRACTS_PATH}" \
        --lang golang \
        --label "${package_label}"
    
    if [ $? -eq 0 ]; then
        print_success "Successfully packaged ${CHAINCODE_NAME} as ${package_file}"
        print_info "Package contains: main.go, startuporg_contract.go, investororg_contract.go,"
        print_info "                  validatororg_contract.go, platformorg_contract.go,"
        print_info "                  token_operations.go, go.mod, go.sum, vendor/"
        echo ""
        print_warning "Next step: Install on all organizations"
        print_warning "Command: source ./deploy_chaincode.sh install"
    else
        print_error "Failed to package ${CHAINCODE_NAME}"
        return 1
    fi
}

# =============================================================================
# Chaincode Installation Functions
# =============================================================================

install_on_org() {
    local org=$1
    local org_name=$2
    
    print_info "Installing on ${org_name}..."
    
    # Find latest package
    latest_package=$(ls -t ${CHAINCODE_NAME}_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_package" ]; then
        print_error "No package file found. Run './deploy_chaincode.sh package' first."
        return 1
    fi
    
    print_info "Installing ${latest_package} on ${org_name}..."
    
    # Install and capture output
    install_output=$(peer lifecycle chaincode install "${latest_package}" 2>&1)
    install_status=$?
    
    echo "$install_output"
    
    if [ $install_status -eq 0 ]; then
        # Extract package ID from install output (appears after "Chaincode code package identifier:")
        local package_id=$(echo "$install_output" | grep -oP 'Chaincode code package identifier: \K.*')
        
        if [ ! -z "$package_id" ]; then
            # Auto-export for THIS org (every org needs it in their context)
            export PACKAGE_ID="$package_id"
            echo "export PACKAGE_ID=\"${PACKAGE_ID}\"" >> ~/.bashrc
            echo ""
            print_success "✅ Auto-exported for ${org_name}: PACKAGE_ID=${PACKAGE_ID}"
            echo ""
        fi
        
        print_success "Successfully installed ${CHAINCODE_NAME} on ${org_name}"
    else
        print_error "Failed to install ${CHAINCODE_NAME} on ${org_name}"
        return 1
    fi
}

install_on_all_orgs() {
    print_header "📥 Installing Combined Chaincode on All Organizations"
    
    # Find latest package
    latest_package=$(ls -t ${CHAINCODE_NAME}_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_package" ]; then
        print_error "No package file found. Run '././deploy_chaincode.sh package' first."
        return 1
    fi
    
    print_info "Package to install: ${latest_package}"
    echo ""
    
    # Install on StartupOrg
    print_header "📦 Installing on StartupOrg"
    print_warning "Press Enter to install on StartupOrg..."
    read -r
    switch_to_startup
    install_on_org "startup" "StartupOrg"
    echo ""
    
    # Install on InvestorOrg
    print_header "📦 Installing on InvestorOrg"
    print_warning "Press Enter to install on InvestorOrg..."
    read -r
    switch_to_investor
    install_on_org "investor" "InvestorOrg"
    echo ""
    
    # Install on ValidatorOrg
    print_header "📦 Installing on ValidatorOrg"
    print_warning "Press Enter to install on ValidatorOrg..."
    read -r
    switch_to_validator
    install_on_org "validator" "ValidatorOrg"
    echo ""
    
    # Install on PlatformOrg
    print_header "📦 Installing on PlatformOrg"
    print_warning "Press Enter to install on PlatformOrg..."
    read -r
    switch_to_platform
    install_on_org "platform" "PlatformOrg"
    
    echo ""
    print_success "Installation complete on all 4 organizations!"
    print_success "PACKAGE_ID exported for all orgs: ${PACKAGE_ID}"
    echo ""
    print_warning "Next step: Deploy (Approve + Commit)"
    print_warning "Command: source ./deploy_chaincode.sh deploy"
}

# =============================================================================
# Query Installed Chaincode
# =============================================================================

query_installed() {
    local org=$1
    
    case "$org" in
        startup)
            switch_to_startup
            ;;
        investor)
            switch_to_investor
            ;;
        validator)
            switch_to_validator
            ;;
        platform)
            switch_to_platform
            ;;
        *)
            print_error "Invalid organization: $org"
            print_info "Valid options: startup, investor, validator, platform"
            return 1
            ;;
    esac
    
    print_info "Querying installed chaincodes on ${org}..."
    peer lifecycle chaincode queryinstalled
}

# =============================================================================
# Approve Chaincode Functions
# =============================================================================

approve_for_org() {
    local org_name=$1
    local sequence=$2
    local version=$3
    
    print_info "Approving chaincode for ${org_name} (version: ${version}, sequence: ${sequence})..."
    
    # IMPORTANT: --collections-config is MANDATORY for Private Data Collections
    peer lifecycle chaincode approveformyorg \
        -o "${ORDERER_URL}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CHAINCODE_NAME}" \
        --version "${version}" \
        --package-id "${PACKAGE_ID}" \
        --sequence "${sequence}" \
        --collections-config "${COLLECTIONS_CONFIG}" \
        --signature-policy "OR('StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')"
    
    if [ $? -eq 0 ]; then
        print_success "Successfully approved for ${org_name} (version: ${version}, sequence: ${sequence})"
    else
        print_error "Failed to approve for ${org_name}"
        return 1
    fi
}

approve_on_all_orgs() {
    local sequence=$1
    local version=$2
    
    print_header "✅ Approving Chaincode on All Organizations"
    
    # Check if PACKAGE_ID is set
    if [ -z "$PACKAGE_ID" ]; then
        print_error "PACKAGE_ID is not set. Please export it first."
        print_warning "Example: export PACKAGE_ID=\"crowdfunding_1:abc123...\""
        return 1
    fi
    
    print_info "Using PACKAGE_ID: ${PACKAGE_ID}"
    print_info "Version: ${version}, Sequence: ${sequence}"
    echo ""
    
    # Approve on StartupOrg
    print_header "📋 Deploying on StartupOrg"
    print_warning "Press Enter to approve chaincode on StartupOrg..."
    read -r
    switch_to_startup
    approve_for_org "StartupOrg" "${sequence}" "${version}"
    echo ""
    
    # Approve on InvestorOrg
    print_header "📋 Deploying on InvestorOrg"
    print_warning "Press Enter to approve chaincode on InvestorOrg..."
    read -r
    switch_to_investor
    approve_for_org "InvestorOrg" "${sequence}" "${version}"
    echo ""
    
    # Approve on ValidatorOrg
    print_header "📋 Deploying on ValidatorOrg"
    print_warning "Press Enter to approve chaincode on ValidatorOrg..."
    read -r
    switch_to_validator
    approve_for_org "ValidatorOrg" "${sequence}" "${version}"
    echo ""
    
    # Approve on PlatformOrg
    print_header "📋 Deploying on PlatformOrg"
    print_warning "Press Enter to approve chaincode on PlatformOrg..."
    read -r
    switch_to_platform
    approve_for_org "PlatformOrg" "${sequence}" "${version}"
    echo ""
    
    print_success "Approval complete on all 4 organizations!"
}

# =============================================================================
# Commit Chaincode Function
# =============================================================================

commit_chaincode() {
    local sequence=$1
    local version=$2
    
    print_header "🚀 Committing Chaincode to Channel"
    
    print_info "Committing ${CHAINCODE_NAME} (version: ${version}, sequence: ${sequence})..."
    
    # Commit from any org (using StartupOrg)
    switch_to_startup
    
    # IMPORTANT: --collections-config is MANDATORY for Private Data Collections
    peer lifecycle chaincode commit \
        -o "${ORDERER_URL}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CHAINCODE_NAME}" \
        --version "${version}" \
        --sequence "${sequence}" \
        --collections-config "${COLLECTIONS_CONFIG}" \
        --signature-policy "OR('StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')" \
        --peerAddresses startuporgpeer-api.127-0-0-1.nip.io:9090 \
        --peerAddresses investororgpeer-api.127-0-0-1.nip.io:9090 \
        --peerAddresses validatororgpeer-api.127-0-0-1.nip.io:9090 \
        --peerAddresses platformorgpeer-api.127-0-0-1.nip.io:9090
    
    if [ $? -eq 0 ]; then
        print_success "Successfully committed ${CHAINCODE_NAME} (version: ${version}, sequence: ${sequence})"
        echo ""
        print_success "🎉 DEPLOYMENT COMPLETE! 🎉"
        echo ""
        print_info "Test your chaincode with:"
        print_info "peer chaincode invoke -o ${ORDERER_URL} \\"
        print_info "  --channelID ${CHANNEL_NAME} -n ${CHAINCODE_NAME} \\"
        print_info "  -c '{\"function\":\"StartupContract:CreateCampaign\",\"Args\":[...]}'"
    else
        print_error "Failed to commit ${CHAINCODE_NAME}"
        return 1
    fi
}

# =============================================================================
# Deploy Function (Approve + Commit)
# =============================================================================

deploy_chaincode() {
    print_header "🚀 Deploying Combined Chaincode"
    
    # Check if PACKAGE_ID is set
    if [ -z "$PACKAGE_ID" ]; then
        print_error "PACKAGE_ID is not set. Please export it first."
        print_warning "Run 'source ./deploy_chaincode.sh install' to install and get PACKAGE_ID"
        return 1
    fi
    
    # Check if collections_config.json exists
    if [ ! -f "${COLLECTIONS_CONFIG}" ]; then
        print_error "collections_config.json not found at ${COLLECTIONS_CONFIG}"
        print_warning "Private Data Collections require collections_config.json"
        return 1
    fi
    
    # Initial deployment: version 1, sequence 1
    local version="1"
    local sequence="1"
    
    # Check if chaincode is already committed
    print_info "Checking if chaincode is already committed..."
    committed_info=$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CHAINCODE_NAME}" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        print_warning "Chaincode is already committed. Detecting version and sequence..."
        current_version=$(echo "$committed_info" | grep -oP 'Version: \K[0-9]+' | head -1)
        current_sequence=$(echo "$committed_info" | grep -oP 'Sequence: \K[0-9]+' | head -1)
        
        version=$((current_version + 1))
        sequence=$((current_sequence + 1))
        
        print_info "Current version: ${current_version}, Current sequence: ${current_sequence}"
        print_info "New version: ${version}, New sequence: ${sequence}"
        print_warning "This will be an UPGRADE, not initial deployment"
    else
        print_info "No committed chaincode found. Proceeding with initial deployment."
    fi
    
    # Approve on all organizations
    approve_on_all_orgs "${sequence}" "${version}"
    
    # Check commit readiness
    echo ""
    print_info "Checking commit readiness..."
    check_commit_readiness
    
    # Commit
    echo ""
    commit_chaincode "${sequence}" "${version}"
}

# =============================================================================
# Upgrade Function
# =============================================================================

upgrade_chaincode() {
    print_header "⬆️  Interactive Chaincode Upgrade"
    
    # 1. Repacakging Prompt
    echo ""
    read -p "Do you want to repackage the chaincode? (y/n): " repackage_choice
    
    local install_mandatory=false

    if [[ "$repackage_choice" == "y" || "$repackage_choice" == "Y" ]]; then
        package_chaincode
        if [ $? -ne 0 ]; then return 1; fi
        install_mandatory=true
    else
        print_info "Skipping repackaging step."
    fi
    
    # 2. Installation Prompt
    local perform_install=false
    
    if [ "$install_mandatory" = true ]; then
        print_warning "Since repackaging was performed, re-installation is COMPULSORY."
        perform_install=true
    else
        echo ""
        read -p "Do you want to re-install the chaincode on all orgs? (y/n): " install_choice
        if [[ "$install_choice" == "y" || "$install_choice" == "Y" ]]; then
            perform_install=true
        else
            print_info "Skipping installation step."
        fi
    fi
    
    if [ "$perform_install" = true ]; then
        install_on_all_orgs
        if [ $? -ne 0 ]; then return 1; fi
    fi
    
    # 3. Deployment (Approve + Commit) Prompt
    echo ""
    read -p "Do you want to proceed with deployment (Approve & Commit)? (y/n): " deploy_choice
    
    if [[ "$deploy_choice" != "y" && "$deploy_choice" != "Y" ]]; then
        print_info "Deployment skipped by user. Process terminated."
        return 0
    fi
    
    print_info "Proceeding with deployment..."
    
    # Check if PACKAGE_ID is set
    if [ -z "$PACKAGE_ID" ]; then
        print_error "PACKAGE_ID is not set. Please export the new package ID."
        print_warning "If you skipped installation, ensure PACKAGE_ID is exported manually."
        return 1
    fi
    
    # Detect current committed version and sequence
    switch_to_startup
    
    print_info "Detecting current committed chaincode..."
    committed_info=$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CHAINCODE_NAME}" 2>/dev/null)
    
    if [ $? -ne 0 ]; then
        print_error "No committed chaincode found. Use 'source ./deploy_chaincode.sh deploy' for initial deployment."
        return 1
    fi
    
    current_version=$(echo "$committed_info" | grep -oP 'Version: \K[0-9]+' | head -1)
    current_sequence=$(echo "$committed_info" | grep -oP 'Sequence: \K[0-9]+' | head -1)
    
    new_version=$((current_version + 1))
    new_sequence=$((current_sequence + 1))
    
    print_info "Current version: ${current_version}, Current sequence: ${current_sequence}"
    print_info "New version: ${new_version}, New sequence: ${new_sequence}"
    
    # Approve on all organizations
    approve_on_all_orgs "${new_sequence}" "${new_version}"
    
    # Check commit readiness
    echo ""
    print_info "Checking commit readiness..."
    check_commit_readiness
    
    # Commit
    echo ""
    commit_chaincode "${new_sequence}" "${new_version}"
}

# =============================================================================
# Query Functions
# =============================================================================

query_committed() {
    print_header "🔍 Querying Committed Chaincode"
    
    switch_to_startup
    
    print_info "Querying committed chaincode '${CHAINCODE_NAME}' on '${CHANNEL_NAME}'..."
    peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CHAINCODE_NAME}"
}

check_commit_readiness() {
    print_header "🔍 Checking Commit Readiness"
    
    switch_to_startup
    
    # Detect sequence from committed or use 1
    committed_info=$(peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CHAINCODE_NAME}" 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        current_sequence=$(echo "$committed_info" | grep -oP 'Sequence: \K[0-9]+' | head -1)
        sequence=$((current_sequence + 1))
    else
        sequence=1
    fi
    
    print_info "Checking commit readiness for sequence ${sequence}..."
    peer lifecycle chaincode checkcommitreadiness \
        --channelID "${CHANNEL_NAME}" \
        --name "${CHAINCODE_NAME}" \
        --version "${sequence}" \
        --sequence "${sequence}" \
        --collections-config "${COLLECTIONS_CONFIG}" \
        --signature-policy "OR('StartupOrgMSP.peer','InvestorOrgMSP.peer','ValidatorOrgMSP.peer','PlatformOrgMSP.peer')"
}

# =============================================================================
# Main Command Handler
# =============================================================================

show_help() {
    cat << EOF

${CYAN}=============================================================================
Crowdfunding Platform v2 - Chaincode Deployment Tool
Single Channel + Combined Chaincode + Private Data Collections
=============================================================================${NC}

${GREEN}PACKAGING COMMANDS:${NC}
  package                 - Package combined chaincode (auto-version)

${GREEN}INSTALLATION COMMANDS:${NC}
  install                 - Install on all 4 organizations

${GREEN}DEPLOYMENT COMMANDS:${NC}
  deploy                  - Full deployment (approve + commit)

${GREEN}UPGRADE COMMANDS:${NC}
  upgrade                 - Upgrade chaincode (auto-increment version/sequence)

${GREEN}QUERY COMMANDS:${NC}
  query-committed         - Query committed chaincode details
  check-readiness         - Check if ready to commit
  query-installed <org>   - Query installed chaincodes (org: startup|investor|validator|platform)

${GREEN}UTILITY COMMANDS:${NC}
  switch <org>            - Switch to organization context
  help                    - Show this help message

${YELLOW}EXAMPLES:${NC}

  ${CYAN}# Initial Deployment${NC}
  source ./deploy_chaincode.sh package
  source ./deploy_chaincode.sh install
  export PACKAGE_ID="crowdfunding_1:abc123..."  # Copy from install output
  source ./deploy_chaincode.sh deploy

  ${CYAN}# Upgrade Existing Chaincode${NC}
  # (Make code changes in contracts/)
  source ./deploy_chaincode.sh package
  source ./deploy_chaincode.sh install
  export PACKAGE_ID="crowdfunding_2:def456..."  # Copy new package ID
  source ./deploy_chaincode.sh upgrade

  ${CYAN}# Query Status${NC}
  source ./deploy_chaincode.sh query-committed
  source ./deploy_chaincode.sh check-readiness
  source ./deploy_chaincode.sh query-installed startup

${YELLOW}IMPORTANT NOTES:${NC}
  - Single channel: ${CHANNEL_NAME}
  - Single chaincode: ${CHAINCODE_NAME}
  - Combined package includes all 5 contracts (Startup, Investor, Validator, Platform, Token)
  - Private Data Collections (PDC) require collections_config.json
  - Always use --collections-config flag during approve/commit
  - Function invocation: ContractName:FunctionName
    Example: StartupContract:CreateCampaign, TokenContract:TransferTokens

EOF
}

# =============================================================================
# Main Script Logic
# =============================================================================

case "$1" in
    package)
        package_chaincode
        ;;
    install)
        install_on_all_orgs
        ;;
    deploy)
        deploy_chaincode
        ;;
    upgrade)
        upgrade_chaincode
        ;;
    query-committed)
        query_committed
        ;;
    check-readiness)
        check_commit_readiness
        ;;
    query-installed)
        if [ -z "$2" ]; then
            print_error "Please specify organization: startup|investor|validator|platform"
            return 1
        fi
        query_installed "$2"
        ;;
    switch)
        if [ -z "$2" ]; then
            print_error "Please specify organization: startup|investor|validator|platform"
            return 1
        fi
        case "$2" in
            startup)
                switch_to_startup
                ;;
            investor)
                switch_to_investor
                ;;
            validator)
                switch_to_validator
                ;;
            platform)
                switch_to_platform
                ;;
            *)
                print_error "Invalid organization: $2"
                return 1
                ;;
        esac
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        print_error "Invalid command: $1"
        echo ""
        print_info "Run 'source ./deploy_chaincode.sh help' for usage information"
        return 1
        ;;
esac
