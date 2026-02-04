#!/bin/bash
#
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║          CHAINPROOF - CHAINCODE DEPLOYMENT SCRIPT                         ║
# ╠═══════════════════════════════════════════════════════════════════════════╣
# ║  Project: ChainProof - Secure Disclosure Network                          ║
# ║  Purpose: Deploy chaincode to Microfab (3 orgs, single channel)           ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# PREREQUISITES:
# 1. Start Microfab:
#    export MICROFAB_CONFIG=$(cat MICROFAB.txt)
#    docker run --name microfab -e MICROFAB_CONFIG -p 7070:7070 ibmcom/ibp-microfab
#
# 2. Generate wallets/gateways/MSP:
#    curl -s http://console.127-0-0-1.nip.io:7070/ak/api/v1/components | weft microfab -w ./_wallets -p ./_gateways -m ./_msp -f
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                         AVAILABLE COMMANDS                                 │
# └───────────────────────────────────────────────────────────────────────────┘
#
# PACKAGING:
#   source ./deploy_chaincode.sh package              - Package chaincode (auto-version)
#
# INSTALLATION:
#   source ./deploy_chaincode.sh install              - Install on all 3 orgs
#
# DEPLOYMENT:
#   source ./deploy_chaincode.sh deploy               - Approve + Commit (initial)
#   source ./deploy_chaincode.sh upgrade              - Upgrade existing chaincode
#
# QUERY & STATUS:
#   source ./deploy_chaincode.sh query-committed      - Query committed chaincode
#   source ./deploy_chaincode.sh check-readiness      - Check commit readiness
#   source ./deploy_chaincode.sh query-installed <org> - Query installed on org
#
# SWITCH ORGANIZATION CONTEXT:
#   source ./deploy_chaincode.sh switch whistleblower - Switch to WhistleblowersOrg
#   source ./deploy_chaincode.sh switch verifier      - Switch to VerifierOrg
#   source ./deploy_chaincode.sh switch legal         - Switch to LegalOrg
#
# TESTING:
#   source ./deploy_chaincode.sh test                 - Test SubmitEvidence function
#
# HELP:
#   source ./deploy_chaincode.sh help                 - Show detailed help
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                         QUICK START                                        │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   1. Package:   source ./deploy_chaincode.sh package
#   2. Install:   source ./deploy_chaincode.sh install
#   3. Deploy:    source ./deploy_chaincode.sh deploy
#   4. Test:      source ./deploy_chaincode.sh test
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                         UPGRADE WORKFLOW                                   │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   source ./deploy_chaincode.sh upgrade
#   (Interactive: prompts for repackage → reinstall → redeploy)
#
# =============================================================================

# =============================================================================
# Global Configuration Variables
# =============================================================================
ORDERER_URL="orderer-api.127-0-0-1.nip.io:7070"
MSP_BASE_PATH="/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof/_msp"
CONTRACTS_PATH="./contracts/chainproof"
CHANNEL_NAME="chainproof-channel"
CHAINCODE_NAME="chainproof"
COLLECTIONS_CONFIG="./contracts/chainproof/collections_config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

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

switch_to_whistleblower() {
    print_info "Switching to WhistleblowersOrg..."
    export CORE_PEER_LOCALMSPID=WhistleblowersOrgMSP
    export CORE_PEER_MSPCONFIGPATH=/home/luminalcore/Academics/Hackathon/TSECHacks_\'26/ChainProof/_msp/WhistleblowersOrg/whistleblowersorgadmin/msp
    export CORE_PEER_ADDRESS=whistleblowersorgpeer-api.127-0-0-1.nip.io:7070
    setup_fabric_env
    print_success "Now operating as WhistleblowersOrg (whistleblowersorgpeer-api.127-0-0-1.nip.io:7070)"
}

switch_to_verifier() {
    print_info "Switching to VerifierOrg..."
    export CORE_PEER_LOCALMSPID=VerifierOrgMSP
    export CORE_PEER_MSPCONFIGPATH=/home/luminalcore/Academics/Hackathon/TSECHacks_\'26/ChainProof/_msp/VerifierOrg/verifierorgadmin/msp
    export CORE_PEER_ADDRESS=verifierorgpeer-api.127-0-0-1.nip.io:7070
    setup_fabric_env
    print_success "Now operating as VerifierOrg (verifierorgpeer-api.127-0-0-1.nip.io:7070)"
}

switch_to_legal() {
    print_info "Switching to LegalOrg..."
    export CORE_PEER_LOCALMSPID=LegalOrgMSP
    export CORE_PEER_MSPCONFIGPATH=/home/luminalcore/Academics/Hackathon/TSECHacks_\'26/ChainProof/_msp/LegalOrg/legalorgadmin/msp
    export CORE_PEER_ADDRESS=legalorgpeer-api.127-0-0-1.nip.io:7070
    setup_fabric_env
    print_success "Now operating as LegalOrg (legalorgpeer-api.127-0-0-1.nip.io:7070)"
}

# =============================================================================
# Chaincode Packaging Function
# =============================================================================

package_chaincode() {
    print_header "📦 Packaging ChainProof Chaincode"
    
    # Setup Fabric environment
    setup_fabric_env
    
    # Navigate to ChainProof directory
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
    # Check if contracts directory exists
    if [ ! -d "${CONTRACTS_PATH}" ]; then
        print_error "Contracts directory not found: ${CONTRACTS_PATH}"
        return 1
    fi
    
    # Navigate to contracts directory for go mod
    cd "${CONTRACTS_PATH}"
    
    # Run go mod tidy
    print_info "Running go mod tidy..."
    go mod tidy
    
    print_info "Running go mod vendor..."
    go mod vendor
    
    # Navigate back to ChainProof root
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
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
        print_info "Package contains: main.go, chainproof.go, models.go, access_control.go, vendor/"
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
        print_error "No package file found. Run 'source ./deploy_chaincode.sh package' first."
        return 1
    fi
    
    print_info "Installing ${latest_package} on ${org_name}..."
    
    # Install and capture output
    install_output=$(peer lifecycle chaincode install "${latest_package}" 2>&1)
    install_status=$?
    
    echo "$install_output"
    
    if [ $install_status -eq 0 ]; then
        # Extract package ID from install output
        local package_id=$(echo "$install_output" | grep -oP 'Chaincode code package identifier: \K.*')
        
        if [ ! -z "$package_id" ]; then
            export PACKAGE_ID="$package_id"
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
    print_header "📥 Installing ChainProof Chaincode on All Organizations"
    
    # Navigate to ChainProof directory
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
    # Find latest package
    latest_package=$(ls -t ${CHAINCODE_NAME}_*.tar.gz 2>/dev/null | head -1)
    
    if [ -z "$latest_package" ]; then
        print_error "No package file found. Run 'source ./deploy_chaincode.sh package' first."
        return 1
    fi
    
    print_info "Package to install: ${latest_package}"
    echo ""
    
    # Install on WhistleblowersOrg
    print_header "📦 Installing on WhistleblowersOrg"
    print_warning "Press Enter to install on WhistleblowersOrg..."
    read -r
    switch_to_whistleblower
    install_on_org "whistleblower" "WhistleblowersOrg"
    echo ""
    
    # Install on VerifierOrg
    print_header "📦 Installing on VerifierOrg"
    print_warning "Press Enter to install on VerifierOrg..."
    read -r
    switch_to_verifier
    install_on_org "verifier" "VerifierOrg"
    echo ""
    
    # Install on LegalOrg
    print_header "📦 Installing on LegalOrg"
    print_warning "Press Enter to install on LegalOrg..."
    read -r
    switch_to_legal
    install_on_org "legal" "LegalOrg"
    
    echo ""
    print_success "Installation complete on all 3 organizations!"
    print_success "PACKAGE_ID exported: ${PACKAGE_ID}"
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
        whistleblower)
            switch_to_whistleblower
            ;;
        verifier)
            switch_to_verifier
            ;;
        legal)
            switch_to_legal
            ;;
        *)
            print_error "Invalid organization: $org"
            print_info "Valid options: whistleblower, verifier, legal"
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
        --signature-policy "OR('WhistleblowersOrgMSP.peer','VerifierOrgMSP.peer','LegalOrgMSP.peer')"
    
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
        print_warning "Example: export PACKAGE_ID=\"chainproof_1:abc123...\""
        return 1
    fi
    
    print_info "Using PACKAGE_ID: ${PACKAGE_ID}"
    print_info "Version: ${version}, Sequence: ${sequence}"
    echo ""
    
    # Approve on WhistleblowersOrg
    print_header "📋 Approving on WhistleblowersOrg"
    print_warning "Press Enter to approve chaincode on WhistleblowersOrg..."
    read -r
    switch_to_whistleblower
    approve_for_org "WhistleblowersOrg" "${sequence}" "${version}"
    echo ""
    
    # Approve on VerifierOrg
    print_header "📋 Approving on VerifierOrg"
    print_warning "Press Enter to approve chaincode on VerifierOrg..."
    read -r
    switch_to_verifier
    approve_for_org "VerifierOrg" "${sequence}" "${version}"
    echo ""
    
    # Approve on LegalOrg
    print_header "📋 Approving on LegalOrg"
    print_warning "Press Enter to approve chaincode on LegalOrg..."
    read -r
    switch_to_legal
    approve_for_org "LegalOrg" "${sequence}" "${version}"
    echo ""
    
    print_success "Approval complete on all 3 organizations!"
}

# =============================================================================
# Commit Chaincode Function
# =============================================================================

commit_chaincode() {
    local sequence=$1
    local version=$2
    
    print_header "🚀 Committing Chaincode to Channel"
    
    print_info "Committing ${CHAINCODE_NAME} (version: ${version}, sequence: ${sequence})..."
    
    # Commit from any org (using WhistleblowersOrg)
    switch_to_whistleblower
    
    # IMPORTANT: --collections-config is MANDATORY for Private Data Collections
    peer lifecycle chaincode commit \
        -o "${ORDERER_URL}" \
        --channelID "${CHANNEL_NAME}" \
        --name "${CHAINCODE_NAME}" \
        --version "${version}" \
        --sequence "${sequence}" \
        --collections-config "${COLLECTIONS_CONFIG}" \
        --signature-policy "OR('WhistleblowersOrgMSP.peer','VerifierOrgMSP.peer','LegalOrgMSP.peer')" \
        --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070 \
        --peerAddresses verifierorgpeer-api.127-0-0-1.nip.io:7070 \
        --peerAddresses legalorgpeer-api.127-0-0-1.nip.io:7070
    
    if [ $? -eq 0 ]; then
        print_success "Successfully committed ${CHAINCODE_NAME} (version: ${version}, sequence: ${sequence})"
        echo ""
        print_success "🎉 DEPLOYMENT COMPLETE! 🎉"
        echo ""
        print_info "Test your chaincode with:"
        print_info "peer chaincode invoke -o ${ORDERER_URL} \\"
        print_info "  --channelID ${CHANNEL_NAME} -n ${CHAINCODE_NAME} \\"
        print_info "  -c '{\"function\":\"SubmitEvidence\",\"Args\":[\"EVD001\",\"QmCID...\",\"hash123\",\"document\",\"1024\",\"corruption\"]}'"
    else
        print_error "Failed to commit ${CHAINCODE_NAME}"
        return 1
    fi
}

# =============================================================================
# Deploy Function (Approve + Commit)
# =============================================================================

deploy_chaincode() {
    print_header "🚀 Deploying ChainProof Chaincode"
    
    # Navigate to ChainProof directory
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
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
    
    # Navigate to ChainProof directory
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
    # 1. Repackaging Prompt
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
    switch_to_whistleblower
    
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
    
    # Navigate to ChainProof directory
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
    switch_to_whistleblower
    
    print_info "Querying committed chaincode '${CHAINCODE_NAME}' on '${CHANNEL_NAME}'..."
    peer lifecycle chaincode querycommitted --channelID "${CHANNEL_NAME}" --name "${CHAINCODE_NAME}"
}

check_commit_readiness() {
    print_header "🔍 Checking Commit Readiness"
    
    switch_to_whistleblower
    
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
        --signature-policy "OR('WhistleblowersOrgMSP.peer','VerifierOrgMSP.peer','LegalOrgMSP.peer')"
}

# =============================================================================
# Test Chaincode
# =============================================================================

test_chaincode() {
    print_header "🧪 Testing ChainProof Chaincode"
    
    # Navigate to ChainProof directory
    cd "/home/luminalcore/Academics/Hackathon/TSECHacks_'26/ChainProof"
    
    switch_to_whistleblower
    
    local test_id="EVD_$(date +%s)"
    
    print_info "Submitting test evidence: $test_id"
    
    peer chaincode invoke \
        -o ${ORDERER_URL} \
        -C ${CHANNEL_NAME} \
        -n ${CHAINCODE_NAME} \
        -c "{\"function\":\"SubmitEvidence\",\"Args\":[\"${test_id}\",\"QmTestCID123\",\"abc123hash\",\"document\",\"1024\",\"corruption\"]}" \
        --peerAddresses whistleblowersorgpeer-api.127-0-0-1.nip.io:7070
    
    if [ $? -eq 0 ]; then
        print_success "Test submission successful!"
        echo ""
        print_info "Querying evidence..."
        sleep 2
        peer chaincode query \
            -C ${CHANNEL_NAME} \
            -n ${CHAINCODE_NAME} \
            -c "{\"function\":\"GetEvidence\",\"Args\":[\"${test_id}\"]}"
    else
        print_error "Test failed"
    fi
}

# =============================================================================
# Main Command Handler
# =============================================================================

show_help() {
    cat << EOF

${CYAN}=============================================================================
ChainProof - Secure Disclosure Network - Chaincode Deployment Tool
Single Channel + Combined Chaincode + Private Data Collections
=============================================================================${NC}

${GREEN}PACKAGING COMMANDS:${NC}
  package                 - Package combined chaincode (auto-version)

${GREEN}INSTALLATION COMMANDS:${NC}
  install                 - Install on all 3 organizations

${GREEN}DEPLOYMENT COMMANDS:${NC}
  deploy                  - Full deployment (approve + commit)

${GREEN}UPGRADE COMMANDS:${NC}
  upgrade                 - Upgrade chaincode (auto-increment version/sequence)

${GREEN}QUERY COMMANDS:${NC}
  query-committed         - Query committed chaincode details
  check-readiness         - Check if ready to commit
  query-installed <org>   - Query installed chaincodes (org: whistleblower|verifier|legal)

${GREEN}UTILITY COMMANDS:${NC}
  switch <org>            - Switch to organization context
  test                    - Test SubmitEvidence function
  help                    - Show this help message

${YELLOW}EXAMPLES:${NC}

  ${CYAN}# Initial Deployment${NC}
  source ./deploy_chaincode.sh package
  source ./deploy_chaincode.sh install
  source ./deploy_chaincode.sh deploy

  ${CYAN}# Upgrade Existing Chaincode${NC}
  source ./deploy_chaincode.sh upgrade

  ${CYAN}# Query Status${NC}
  source ./deploy_chaincode.sh query-committed
  source ./deploy_chaincode.sh query-installed whistleblower

  ${CYAN}# Switch Context${NC}
  source ./deploy_chaincode.sh switch whistleblower
  source ./deploy_chaincode.sh switch verifier
  source ./deploy_chaincode.sh switch legal

${YELLOW}IMPORTANT NOTES:${NC}
  - Single channel: ${CHANNEL_NAME}
  - Single chaincode: ${CHAINCODE_NAME}
  - Private Data Collections require collections_config.json
  - Orgs: WhistleblowersOrg, VerifierOrg, LegalOrg

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
            print_error "Please specify organization: whistleblower|verifier|legal"
            return 1
        fi
        query_installed "$2"
        ;;
    switch)
        if [ -z "$2" ]; then
            print_error "Please specify organization: whistleblower|verifier|legal"
            return 1
        fi
        case "$2" in
            whistleblower)
                switch_to_whistleblower
                ;;
            verifier)
                switch_to_verifier
                ;;
            legal)
                switch_to_legal
                ;;
            *)
                print_error "Invalid organization: $2"
                return 1
                ;;
        esac
        ;;
    test)
        test_chaincode
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
