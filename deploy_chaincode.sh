#!/bin/bash
#
# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║          eVAULT HYPERLEDGER FABRIC - CHAINCODE DEPLOYMENT SCRIPT          ║
# ╠═══════════════════════════════════════════════════════════════════════════╣
# ║  Author: eVAULT Development Team                                          ║
# ║  Purpose: Automate chaincode lifecycle management across 5 organizations  ║
# ╚═══════════════════════════════════════════════════════════════════════════╝
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                         PREREQUISITES                                      │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   1. Start the MicroFab network:
#      export MICROFAB_CONFIG=$(cat MICROFAB.txt)
#      docker run --name microfab -e MICROFAB_CONFIG -p 7070:7070 ibmcom/ibp-microfab
#
#   2. Generate wallets, gateways, and MSP configs:
#      curl -s http://console.127-0-0-1.nip.io:7070/ak/api/v1/components | weft microfab -w ./_wallets -p ./_gateways -m ./_msp -f
#
#   3. Install Fabric binaries (peer, configtxgen, etc.):
#      curl -sSL https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh | bash -s -- binary
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                    QUICK START - FIRST TIME SETUP                         │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   Run these 3 commands in order (after prerequisites):
#
#   Step 1: Package all chaincodes (creates .tgz files)
#   $ source ./deploy_chaincode.sh package
#
#   Step 2: Install chaincodes on ALL organizations (auto-switches orgs)
#   $ source ./deploy_chaincode.sh global-install
#   → Press Enter to proceed with each org, 's' to skip, 'q' to quit
#
#   Step 3: Deploy chaincodes on ALL organizations (approve + commit)
#   $ source ./deploy_chaincode.sh global-deploy
#   → Press Enter to proceed with each org, 's' to skip, 'q' to quit
#
#   ✅ Done! All chaincodes are now active on the network.
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                    UPGRADE WORKFLOW - UPDATE CHAINCODE                    │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   When you modify chaincode source code and want to deploy the new version:
#
#   Step 1: Package the updated chaincode (auto-increments version)
#   $ source ./deploy_chaincode.sh package lawyer
#
#   Step 2: Upgrade across ALL required organizations (auto-switches orgs)
#   $ source ./deploy_chaincode.sh global-upgrade lawyer
#   → Automatically installs, approves, and commits on all orgs that need it
#   → Press Enter to proceed with each step, 's' to skip, 'q' to quit
#
#   ✅ Done! The upgraded chaincode is now active.
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                         INTERACTIVE PROMPTS                               │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   The global commands show what they're about to do and wait for input:
#
#   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#   NEXT ACTION: Switch to RegistrarsOrg and install: registrar, lawyer, stampreporter
#   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#     [Enter] Proceed  |  [s] Skip  |  [q] Quit
#     Your choice: 
#
#   - Press ENTER → Execute the action and continue
#   - Press 's'   → Skip this step and move to next
#   - Press 'q'   → Quit the entire automation
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                         ALL AVAILABLE COMMANDS                            │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   GLOBAL AUTOMATED COMMANDS (Recommended):
#   ─────────────────────────────────────────
#   global-install              Install all chaincodes on ALL orgs
#   global-deploy               Initial deploy on ALL orgs (FIRST TIME ONLY)
#   global-upgrade <chaincode>  Upgrade chaincode across ALL required orgs
#
#   MANUAL COMMANDS (For specific operations):
#   ──────────────────────────────────────────
#   switch <org>                Switch to organization context
#                               Options: lawyerorg, registrarorg, stampreporterorg,
#                                        benchclerkorg, judgeorg
#
#   package                     Package all chaincodes
#   package <name>              Package specific chaincode
#                               Options: lawyer, registrar, stampreporter,
#                                        benchclerk, judge
#
#   install <org>               Install chaincodes on specific org
#   deploy <org>                Deploy for specific org (first time)
#   upgrade <chaincode>         Upgrade chaincode (owner org only)
#   sync-upgrade <chaincode>    Sync upgrade to other orgs
#
#   query                       Query all committed chaincodes
#   query-installed             Query installed chaincodes on current peer
#   pending <org>               Show pending approvals for an org
#
#   help                        Show usage information
#
# ┌───────────────────────────────────────────────────────────────────────────┐
# │                      NETWORK TOPOLOGY REFERENCE                           │
# └───────────────────────────────────────────────────────────────────────────┘
#
#   Organizations:
#   ──────────────
#   LawyersOrg        → Uses: lawyer, registrar, stampreporter, benchclerk
#   RegistrarsOrg     → Uses: registrar, lawyer, stampreporter
#   StampReportersOrg → Uses: stampreporter, registrar, lawyer, benchclerk
#   BenchClerksOrg    → Uses: benchclerk, stampreporter, judge, lawyer
#   JudgesOrg         → Uses: judge, benchclerk
#
#   Channels:
#   ─────────
#   lawyer-registrar-channel        → LawyersOrg, RegistrarsOrg
#   registrar-stampreporter-channel → RegistrarsOrg, StampReportersOrg
#   stampreporter-lawyer-channel    → StampReportersOrg, LawyersOrg
#   stampreporter-benchclerk-channel→ StampReportersOrg, BenchClerksOrg
#   benchclerk-judge-channel        → BenchClerksOrg, JudgesOrg
#   benchclerk-lawyer-channel       → BenchClerksOrg, LawyersOrg
#
#   Chaincode Ownership (who approves+commits first):
#   ─────────────────────────────────────────────────
#   lawyer        → LawyersOrg (owner)
#   registrar     → RegistrarsOrg (owner)
#   stampreporter → StampReportersOrg (owner)
#   benchclerk    → BenchClerksOrg (owner)
#   judge         → JudgesOrg (owner)
#
# =============================================================================
# Chaincode Deployment Script for eVAULT Hyperledger Fabric Platform
# =============================================================================
#
# FEATURES:
# ---------
# 1. Organization Context Switching
#    - switch_to_lawyerorg/registrarorg/stampreporterorg/benchclerkorg/judgeorg functions
#    - Automatically exports CORE_PEER_LOCALMSPID, CORE_PEER_MSPCONFIGPATH, CORE_PEER_ADDRESS
#    - Sets up PATH and FABRIC_CFG_PATH after each org switch
#    - Uses global MSP_BASE_PATH variable for MSP config paths
#
# 2. Chaincode Packaging with Auto-Versioning
#    - package_chaincode function with auto-incrementing version
#    - Detects existing .tgz files and increments version (lawyer_1.tgz -> lawyer_2.tgz)
#    - Uses global CONTRACTS_BASE_PATH for contract paths
#    - package_all_chaincodes packages all 5 chaincodes at once
#
# 3. Interactive Chaincode Installation
#    - install_chaincode_interactive prompts for package ID after each install
#    - install_on_lawyer/registrar/stampreporter/benchclerk/judge installs required chaincodes per org
#    - Automatically finds latest package files
#    - Displays export command for package ID
#
# 4. Approve and Commit with Auto-Sequence Detection
#    - Auto-detects current committed sequence/version
#    - Increments sequence and version automatically
#
# GLOBAL VARIABLES:
# -----------------
#   MSP_BASE_PATH       - Base path for MSP configs
#   CONTRACTS_BASE_PATH - Base path for contracts
#   ORDERER_URL         - Orderer API URL
#
# =============================================================================
# Usage:
#   source ./deploy_chaincode.sh <command> [options]
#
# ═══════════════════════════════════════════════════════════════════════════
# GLOBAL AUTOMATED COMMANDS (Recommended - auto-switch orgs, prompts before each step):
# ═══════════════════════════════════════════════════════════════════════════
#   global-install           - Install all chaincodes on ALL orgs (auto-switch, prompts)
#   global-deploy            - Initial deploy on ALL orgs (FIRST TIME ONLY)
#   global-upgrade <cc>      - Upgrade chaincode across ALL required orgs (auto-switch)
#
# Commands:
#   package              - Package all chaincodes with auto-versioning
#   package <name>       - Package specific chaincode (lawyer/registrar/stampreporter/benchclerk/judge)
#   install <org>        - Install chaincodes on specific org (interactive)
#   install-all          - Install chaincodes on all orgs (interactive)
#   deploy <org>         - INITIAL deployment (approve/commit) for specific org - USE ONLY ONCE
#   upgrade <chaincode>  - Upgrade chaincode with NEW code version (auto-prompts for other orgs)
#   sync-upgrade <chaincode> - Sync already upgraded chaincode to other orgs (if deploy was used)
#   switch <org>         - Switch to organization context (lawyerorg/registrarorg/etc)
#   query                - Query all committed chaincodes
#
# ═══════════════════════════════════════════════════════════════════════════
# QUICK START (First Time Setup):
# ═══════════════════════════════════════════════════════════════════════════
#   1. Package all:     source ./deploy_chaincode.sh package
#   2. Install all:     source ./deploy_chaincode.sh global-install
#   3. Deploy all:      source ./deploy_chaincode.sh global-deploy
#
# UPGRADE WORKFLOW (Update existing chaincode):
#   1. Package new:     source ./deploy_chaincode.sh package lawyer
#   2. Upgrade all:     source ./deploy_chaincode.sh global-upgrade lawyer
#
# IMPORTANT: Upgrading Chaincodes
# --------------------------------
#   FIRST TIME SETUP (when network is new):
#     → Use: source ./deploy_chaincode.sh global-deploy
#
#   UPGRADING EXISTING CHAINCODE (with new code):
#     1. Package new version:  source ./deploy_chaincode.sh package <chaincode>
#     2. Install on owner org: source ./deploy_chaincode.sh install <org>
#     3. Upgrade on network:   source ./deploy_chaincode.sh upgrade <chaincode>
#     → This will auto-prompt to sync other orgs
#
#   IF YOU ACCIDENTALLY USED 'deploy' INSTEAD OF 'upgrade':
#     → Use: source ./deploy_chaincode.sh sync-upgrade <chaincode>
#     → This syncs other orgs to the already-deployed version
#
# Channel Topology (from MICROFAB.txt):
#   - lawyer-registrar-channel:        LawyersOrg, RegistrarsOrg
#   - registrar-stampreporter-channel: RegistrarsOrg, StampReportersOrg
#   - stampreporter-lawyer-channel:    StampReportersOrg, LawyersOrg
#   - stampreporter-benchclerk-channel: StampReportersOrg, BenchClerksOrg
#   - benchclerk-judge-channel:        BenchClerksOrg, JudgesOrg
#   - benchclerk-lawyer-channel:       BenchClerksOrg, LawyersOrg
#
# Chaincode Installation per Org:
#   - LawyersOrg:        lawyer, registrar, stampreporter, benchclerk
#   - RegistrarsOrg:     registrar, lawyer, stampreporter
#   - StampReportersOrg: stampreporter, registrar, lawyer, benchclerk
#   - BenchClerksOrg:    benchclerk, stampreporter, judge, lawyer
#   - JudgesOrg:         judge, benchclerk
#
# Workflow:
#   Switch <org> options:
#       source ./deploy_chaincode.sh switch lawyerorg
#       source ./deploy_chaincode.sh switch registrarorg
#       source ./deploy_chaincode.sh switch stampreporterorg
#       source ./deploy_chaincode.sh switch benchclerkorg
#       source ./deploy_chaincode.sh switch judgeorg
#
#   1. Package chaincodes:  
#      All chaincodes:      source ./deploy_chaincode.sh package
#      Specific chaincode:  source ./deploy_chaincode.sh package lawyer
#                           source ./deploy_chaincode.sh package registrar
#                           source ./deploy_chaincode.sh package stampreporter
#                           source ./deploy_chaincode.sh package benchclerk
#                           source ./deploy_chaincode.sh package judge
#      NOTE: Packaging automatically increments version (e.g., lawyer_1.tgz → lawyer_2.tgz)
#
#   2. Install per org:     source ./deploy_chaincode.sh install lawyer
#                           source ./deploy_chaincode.sh install registrar
#                           source ./deploy_chaincode.sh install stampreporter
#                           source ./deploy_chaincode.sh install benchclerk
#                           source ./deploy_chaincode.sh install judge
#   3. Export package IDs after each installation (prompted automatically)
#   4. Deploy per org:      source ./deploy_chaincode.sh deploy lawyer
#                           source ./deploy_chaincode.sh deploy registrar
#                           source ./deploy_chaincode.sh deploy stampreporter
#                           source ./deploy_chaincode.sh deploy benchclerk
#                           source ./deploy_chaincode.sh deploy judge
#
# =============================================================================
# APPROVE-CHAINCODE COMMAND - For Cross-Org Chaincode Approvals
# =============================================================================
#
# Command Format:
#   source ./deploy_chaincode.sh approve-chaincode <org> <chaincode> <channel>
#   
# Parameters:
#   - <org>       = The org context to switch to (who is doing the approval)
#   - <chaincode> = The chaincode being approved (could be another org's chaincode)
#   - <channel>   = The channel where the chaincode needs approval
#
# When to use this command:
#   - When an org upgrades their chaincode, all other orgs on shared channels
#     must approve the new version before the upgrade is complete.
#   - Use this command to approve another org's chaincode on a specific channel.
#
# -----------------------------------------------------------------------------
# SCENARIO 1: LawyersOrg upgrades "lawyer" chaincode
# -----------------------------------------------------------------------------
# After LawyersOrg runs: source ./deploy_chaincode.sh upgrade lawyer
#
# These orgs must approve the "lawyer" chaincode on their shared channels:
#   RegistrarsOrg:     source ./deploy_chaincode.sh approve-chaincode registrar lawyer lawyer-registrar-channel
#   StampReportersOrg: source ./deploy_chaincode.sh approve-chaincode stampreporter lawyer stampreporter-lawyer-channel
#   BenchClerksOrg:    source ./deploy_chaincode.sh approve-chaincode benchclerk lawyer benchclerk-lawyer-channel
#
# -----------------------------------------------------------------------------
# SCENARIO 2: RegistrarsOrg upgrades "registrar" chaincode
# -----------------------------------------------------------------------------
# After RegistrarsOrg runs: source ./deploy_chaincode.sh upgrade registrar
#
# These orgs must approve the "registrar" chaincode on their shared channels:
#   LawyersOrg:        source ./deploy_chaincode.sh approve-chaincode lawyer registrar lawyer-registrar-channel
#   StampReportersOrg: source ./deploy_chaincode.sh approve-chaincode stampreporter registrar registrar-stampreporter-channel
#
# -----------------------------------------------------------------------------
# SCENARIO 3: StampReportersOrg upgrades "stampreporter" chaincode
# -----------------------------------------------------------------------------
# After StampReportersOrg runs: source ./deploy_chaincode.sh upgrade stampreporter
#
# These orgs must approve the "stampreporter" chaincode on their shared channels:
#   RegistrarsOrg:  source ./deploy_chaincode.sh approve-chaincode registrar stampreporter registrar-stampreporter-channel
#   LawyersOrg:     source ./deploy_chaincode.sh approve-chaincode lawyer stampreporter stampreporter-lawyer-channel
#   BenchClerksOrg: source ./deploy_chaincode.sh approve-chaincode benchclerk stampreporter stampreporter-benchclerk-channel
#
# -----------------------------------------------------------------------------
# SCENARIO 4: BenchClerksOrg upgrades "benchclerk" chaincode
# -----------------------------------------------------------------------------
# After BenchClerksOrg runs: source ./deploy_chaincode.sh upgrade benchclerk
#
# These orgs must approve the "benchclerk" chaincode on their shared channels:
#   StampReportersOrg: source ./deploy_chaincode.sh approve-chaincode stampreporter benchclerk stampreporter-benchclerk-channel
#   JudgesOrg:         source ./deploy_chaincode.sh approve-chaincode judge benchclerk benchclerk-judge-channel
#   LawyersOrg:        source ./deploy_chaincode.sh approve-chaincode lawyer benchclerk benchclerk-lawyer-channel
#
# -----------------------------------------------------------------------------
# SCENARIO 5: JudgesOrg upgrades "judge" chaincode
# -----------------------------------------------------------------------------
# After JudgesOrg runs: source ./deploy_chaincode.sh upgrade judge
#
# These orgs must approve the "judge" chaincode on their shared channels:
#   BenchClerksOrg: source ./deploy_chaincode.sh approve-chaincode benchclerk judge benchclerk-judge-channel
#
# -----------------------------------------------------------------------------
# IMPORTANT NOTES:
# -----------------------------------------------------------------------------
#   1. The first parameter is the ORG doing the approval (context switch)
#   2. The second parameter is the CHAINCODE being approved (not the org's own)
#   3. The third parameter is the CHANNEL where the chaincode is deployed
#   4. Before approving, the org must have the chaincode package INSTALLED
#------> 5. Use "pending" command to check what needs approval:
#      source ./deploy_chaincode.sh pending <org>
#
# =============================================================================

# Disable exit on error for better error handling when sourcing
# set -e

# =============================================================================
# Global Configuration Variables
# =============================================================================
ORDERER_URL="orderer-api.127-0-0-1.nip.io:9090"
MSP_BASE_PATH="/home/luminalcore/TE_Code/eVAULT_HyperledgerFabric/backend_terminal/_msp"
CONTRACTS_BASE_PATH="./eVAULT_Contract/contracts"

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

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
    echo ""
    echo -e "${YELLOW}=============================================================================${NC}"
    echo -e "${YELLOW} $1${NC}"
    echo -e "${YELLOW}=============================================================================${NC}"
}

# =============================================================================
# Organization Context Switching Functions
# =============================================================================

# Setup Fabric environment paths
setup_fabric_env() {
    export PATH=$PATH:${PWD}/bin
    export FABRIC_CFG_PATH=${PWD}/config
    log_info "Fabric environment paths configured"
}

# Switch to LawyersOrg context
switch_to_lawyerorg() {
    log_info "Switching to LawyersOrg context..."
    export CORE_PEER_LOCALMSPID=LawyersOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/LawyersOrg/lawyersorgadmin/msp
    export CORE_PEER_ADDRESS=lawyersorgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    log_success "Now using LawyersOrg identity"
}

# Switch to RegistrarsOrg context
switch_to_registrarorg() {
    log_info "Switching to RegistrarsOrg context..."
    export CORE_PEER_LOCALMSPID=RegistrarsOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/RegistrarsOrg/registrarsorgadmin/msp
    export CORE_PEER_ADDRESS=registrarsorgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    log_success "Now using RegistrarsOrg identity"
}

# Switch to StampReportersOrg context
switch_to_stampreporterorg() {
    log_info "Switching to StampReportersOrg context..."
    export CORE_PEER_LOCALMSPID=StampReportersOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/StampReportersOrg/stampreportersorgadmin/msp
    export CORE_PEER_ADDRESS=stampreportersorgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    log_success "Now using StampReportersOrg identity"
}

# Switch to BenchClerksOrg context
switch_to_benchclerkorg() {
    log_info "Switching to BenchClerksOrg context..."
    export CORE_PEER_LOCALMSPID=BenchClerksOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/BenchClerksOrg/benchclerksorgadmin/msp
    export CORE_PEER_ADDRESS=benchclerksorgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    log_success "Now using BenchClerksOrg identity"
}

# Switch to JudgesOrg context
switch_to_judgeorg() {
    log_info "Switching to JudgesOrg context..."
    export CORE_PEER_LOCALMSPID=JudgesOrgMSP
    export CORE_PEER_MSPCONFIGPATH=${MSP_BASE_PATH}/JudgesOrg/judgesorgadmin/msp
    export CORE_PEER_ADDRESS=judgesorgpeer-api.127-0-0-1.nip.io:9090
    setup_fabric_env
    log_success "Now using JudgesOrg identity"
}

# Generic org switcher
switch_org() {
    local org=$1
    case $org in
        lawyerorg)
            switch_to_lawyerorg
            ;;
        registrarorg)
            switch_to_registrarorg
            ;;
        stampreporterorg)
            switch_to_stampreporterorg
            ;;
        benchclerkorg)
            switch_to_benchclerkorg
            ;;
        judgeorg)
            switch_to_judgeorg
            ;;
        *)
            log_error "Unknown organization: $org"
            echo "Valid options: lawyerorg, registrarorg, stampreporterorg, benchclerkorg, judgeorg"
            return 1
            ;;
    esac
}

# =============================================================================
# Chaincode Packaging Functions
# =============================================================================

# Get next package version by checking existing .tgz files
get_next_package_version() {
    local chaincode_name=$1
    local max_version=0
    
    # Find all existing packages matching pattern
    shopt -s nullglob
    for file in ${chaincode_name}_*.tgz; do
        if [ -f "$file" ]; then
            # Extract version number from filename (e.g., lawyer_3.tgz -> 3)
            version=$(echo "$file" | sed -n "s/${chaincode_name}_\([0-9]\+\)\.tgz/\1/p")
            if [ -n "$version" ] && [ "$version" -gt "$max_version" ]; then
                max_version=$version
            fi
        fi
    done
    shopt -u nullglob
    
    echo $((max_version + 1))
}

# Package a single chaincode with auto-incrementing version
package_chaincode() {
    local chaincode_name=$1
    local contract_path="${CONTRACTS_BASE_PATH}/${chaincode_name}"
    
    # Get next version
    local version=$(get_next_package_version "$chaincode_name")
    local package_file="${chaincode_name}_${version}.tgz"
    local label="${chaincode_name}_${version}"
    
    log_section "Packaging ${chaincode_name} chaincode"
    log_info "Version: ${version}"
    log_info "Package: ${package_file}"
    log_info "Label: ${label}"
    log_info "Path: ${contract_path}"
    
    # Check if contract path exists
    if [ ! -d "$contract_path" ]; then
        log_error "Contract path does not exist: $contract_path"
        return 1
    fi
    
    # Package the chaincode
    peer lifecycle chaincode package "$package_file" \
        --path "$contract_path" \
        --lang golang \
        --label "$label"
    
    if [ $? -eq 0 ]; then
        log_success "Packaged ${chaincode_name} as ${package_file}"
        echo "$package_file"  # Return package filename
    else
        log_error "Failed to package ${chaincode_name}"
        return 1
    fi
}

# Package all chaincodes
package_all_chaincodes() {
    log_section "Packaging All Chaincodes"
    
    local lawyer_pkg=$(package_chaincode "lawyer")
    local registrar_pkg=$(package_chaincode "registrar")
    local stampreporter_pkg=$(package_chaincode "stampreporter")
    local benchclerk_pkg=$(package_chaincode "benchclerk")
    local judge_pkg=$(package_chaincode "judge")
    
    log_success "All chaincodes packaged successfully!"
    echo ""
    log_info "Package files created:"
    log_info "  - $lawyer_pkg"
    log_info "  - $registrar_pkg"
    log_info "  - $stampreporter_pkg"
    log_info "  - $benchclerk_pkg"
    log_info "  - $judge_pkg"
}

# =============================================================================
# Chaincode Installation Functions
# =============================================================================

# Get latest package file for a chaincode
get_latest_package() {
    local chaincode_name=$1
    ls -t ${chaincode_name}_*.tgz 2>/dev/null | head -1
}

# Install chaincode on current peer and prompt for package ID
install_chaincode_interactive() {
    local chaincode_name=$1
    local package_file=$2
    
    # Extract version from package filename (e.g., lawyer_3.tgz -> 3)
    local version=$(echo "$package_file" | sed -n "s/${chaincode_name}_\([0-9]\+\)\.tgz/\1/p")
    
    # Display detailed installation information
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}INSTALLING CHAINCODE PACKAGE${NC}                                         ${CYAN}│${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC} Chaincode:     ${GREEN}${chaincode_name}${NC}"
    echo -e "${CYAN}│${NC} Version:       ${GREEN}${version}${NC}"
    echo -e "${CYAN}│${NC} Package File:  ${GREEN}${package_file}${NC}"
    echo -e "${CYAN}│${NC} Organization:  ${GREEN}${CORE_PEER_LOCALMSPID}${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    echo ""
    
    log_section "Installing ${chaincode_name} chaincode"
    
    if [ -z "$package_file" ] || [ ! -f "$package_file" ]; then
        log_error "Package file not found: $package_file"
        log_info "Run 'source ./deploy_chaincode.sh package' first to create packages"
        return 1
    fi
    
    log_info "Installing ${package_file} on current peer..."
    
    # Install the chaincode
    local install_output=$(peer lifecycle chaincode install "$package_file" 2>&1)
    local install_status=$?
    
    echo "$install_output"
    
    # Check if already installed (extract from error message)
    if echo "$install_output" | grep -q "already successfully installed"; then
        log_warning "${chaincode_name} already installed"
        
        # Extract package ID from error message
        local package_id=$(echo "$install_output" | grep -oP "package ID '\K[^']+")
        
        if [ -z "$package_id" ]; then
            # Fallback: query installed chaincodes
            log_info "Querying installed chaincodes to get package ID..."
            local query_output=$(peer lifecycle chaincode queryinstalled 2>&1)
            package_id=$(echo "$query_output" | grep "Label: ${chaincode_name}_" | head -1 | grep -oP "Package ID: \K[^,]+")
        fi
        
        if [ ! -z "$package_id" ]; then
            log_info "Package ID: ${package_id}"
            echo ""
            
            # Auto-export the package ID
            local var_name="${chaincode_name^^}_CC_PACKAGE_ID"
            export ${var_name}="${package_id}"
            
            log_success "Auto-exported: ${var_name}=${package_id}"
            echo ""
            log_info "You can also manually export with:"
            echo -e "${CYAN}export ${var_name}=${package_id}${NC}"
            echo ""
            
            # Prompt to continue
            read -p "Press Enter to continue to next chaincode..."
        else
            log_error "Could not extract package ID for ${chaincode_name}"
            return 1
        fi
        
    elif [ $install_status -eq 0 ]; then
        log_success "${chaincode_name} installed successfully!"
        
        # Extract package ID from output
        local package_id=$(echo "$install_output" | grep -o 'Chaincode code package identifier: .*' | cut -d ' ' -f 5)
        
        if [ ! -z "$package_id" ]; then
            log_info "Package ID: ${package_id}"
            echo ""
            
            # Auto-export the package ID
            local var_name="${chaincode_name^^}_CC_PACKAGE_ID"
            export ${var_name}="${package_id}"
            
            log_success "Auto-exported: ${var_name}=${package_id}"
            echo ""
            log_info "You can also manually export with:"
            echo -e "${CYAN}export ${var_name}=${package_id}${NC}"
            echo ""
            
            # Prompt to continue
            read -p "Press Enter to continue to next chaincode..."
        fi
    else
        log_error "Failed to install ${chaincode_name}"
        return 1
    fi
}

# Install chaincodes on LawyersOrg peer
# Required: lawyer, registrar, stampreporter, benchclerk
install_on_lawyer() {
    log_section "Installing Chaincodes on LawyersOrg"
    log_info "Required chaincodes: lawyer, registrar, stampreporter, benchclerk"
    switch_to_lawyerorg
    
    local lawyer_pkg=$(get_latest_package "lawyer")
    local registrar_pkg=$(get_latest_package "registrar")
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    
    install_chaincode_interactive "lawyer" "$lawyer_pkg"
    install_chaincode_interactive "registrar" "$registrar_pkg"
    install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    
    log_success "LawyersOrg installation complete!"
    log_info "Installed: lawyer, registrar, stampreporter, benchclerk"
}

# Install chaincodes on RegistrarsOrg peer
# Required: registrar, lawyer, stampreporter
install_on_registrar() {
    log_section "Installing Chaincodes on RegistrarsOrg"
    log_info "Required chaincodes: registrar, lawyer, stampreporter"
    switch_to_registrarorg
    
    local registrar_pkg=$(get_latest_package "registrar")
    local lawyer_pkg=$(get_latest_package "lawyer")
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    
    install_chaincode_interactive "registrar" "$registrar_pkg"
    install_chaincode_interactive "lawyer" "$lawyer_pkg"
    install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    
    log_success "RegistrarsOrg installation complete!"
    log_info "Installed: registrar, lawyer, stampreporter"
}

# Install chaincodes on StampReportersOrg peer
# Required: stampreporter, registrar, lawyer, benchclerk
install_on_stampreporter() {
    log_section "Installing Chaincodes on StampReportersOrg"
    log_info "Required chaincodes: stampreporter, registrar, lawyer, benchclerk"
    switch_to_stampreporterorg
    
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    local registrar_pkg=$(get_latest_package "registrar")
    local lawyer_pkg=$(get_latest_package "lawyer")
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    
    install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    install_chaincode_interactive "registrar" "$registrar_pkg"
    install_chaincode_interactive "lawyer" "$lawyer_pkg"
    install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    
    log_success "StampReportersOrg installation complete!"
    log_info "Installed: stampreporter, registrar, lawyer, benchclerk"
}

# Install chaincodes on BenchClerksOrg peer
# Required: benchclerk, stampreporter, judge, lawyer
install_on_benchclerk() {
    log_section "Installing Chaincodes on BenchClerksOrg"
    log_info "Required chaincodes: benchclerk, stampreporter, judge, lawyer"
    switch_to_benchclerkorg
    
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    local judge_pkg=$(get_latest_package "judge")
    local lawyer_pkg=$(get_latest_package "lawyer")
    
    install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    install_chaincode_interactive "judge" "$judge_pkg"
    install_chaincode_interactive "lawyer" "$lawyer_pkg"
    
    log_success "BenchClerksOrg installation complete!"
    log_info "Installed: benchclerk, stampreporter, judge, lawyer"
}

# Install chaincodes on JudgesOrg peer
# Required: judge, benchclerk
install_on_judge() {
    log_section "Installing Chaincodes on JudgesOrg"
    log_info "Required chaincodes: judge, benchclerk"
    switch_to_judgeorg
    
    local judge_pkg=$(get_latest_package "judge")
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    
    install_chaincode_interactive "judge" "$judge_pkg"
    install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    
    log_success "JudgesOrg installation complete!"
    log_info "Installed: judge, benchclerk"
}

# Install on all orgs sequentially with prompts
install_all_orgs() {
    log_section "Installing Chaincodes on All Organizations"
    
    echo ""
    read -p "Install on LawyersOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        install_on_lawyer
    fi
    
    echo ""
    read -p "Install on RegistrarsOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        install_on_registrar
    fi
    
    echo ""
    read -p "Install on StampReportersOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        install_on_stampreporter
    fi
    
    echo ""
    read -p "Install on BenchClerksOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        install_on_benchclerk
    fi
    
    echo ""
    read -p "Install on JudgesOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        install_on_judge
    fi
    
    log_success "Installation on all orgs complete!"
}

# =============================================================================
# Sequence and Version Detection Functions
# =============================================================================

get_committed_sequence() {
    local channel=$1
    local chaincode_name=$2
    
    local result=$(peer lifecycle chaincode querycommitted \
        --channelID ${channel} \
        --name ${chaincode_name} \
        --output json 2>/dev/null || echo "")
    
    if [ -z "$result" ] || [ "$result" == "" ]; then
        echo "0"
        return
    fi
    
    local sequence=$(echo "$result" | jq -r '.sequence // 0' 2>/dev/null || echo "0")
    
    if [ -z "$sequence" ] || [ "$sequence" == "null" ]; then
        echo "0"
    else
        echo "$sequence"
    fi
}

get_committed_version() {
    local channel=$1
    local chaincode_name=$2
    
    local result=$(peer lifecycle chaincode querycommitted \
        --channelID ${channel} \
        --name ${chaincode_name} \
        --output json 2>/dev/null || echo "")
    
    if [ -z "$result" ] || [ "$result" == "" ]; then
        echo "0"
        return
    fi
    
    local version=$(echo "$result" | jq -r '.version // "0"' 2>/dev/null || echo "0")
    
    if [ -z "$version" ] || [ "$version" == "null" ]; then
        echo "0"
    else
        echo "$version"
    fi
}

get_next_sequence() {
    local channel=$1
    local chaincode_name=$2
    
    local current=$(get_committed_sequence "$channel" "$chaincode_name")
    local next=$((current + 1))
    
    echo "$next"
}

get_next_version() {
    local channel=$1
    local chaincode_name=$2
    
    local current=$(get_committed_version "$channel" "$chaincode_name")
    
    if [ "$current" == "0" ] || [ -z "$current" ]; then
        echo "1"
    else
        if [[ "$current" =~ ^[0-9]+$ ]]; then
            local next=$((current + 1))
            echo "$next"
        else
            echo "$current"
        fi
    fi
}

# =============================================================================
# Approve and Commit Functions
# =============================================================================

# Approve chaincode for current org
# For first-time deployment: use sequence=1, version=1
# For upgrade: use next sequence/version
# The approve command uses the SAME version/sequence that will be committed
approve_chaincode() {
    local channel=$1
    local chaincode_name=$2
    local package_id=$3
    local sequence=${4:-}  # Optional: override sequence
    local version=${5:-}   # Optional: override version
    
    # If sequence/version not provided, calculate them
    if [ -z "$sequence" ]; then
        sequence=$(get_next_sequence "$channel" "$chaincode_name")
    fi
    if [ -z "$version" ]; then
        version=$(get_next_version "$channel" "$chaincode_name")
    fi
    
    # Display detailed deployment information
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}APPROVING CHAINCODE${NC}                                                  ${CYAN}│${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC} Chaincode:  ${GREEN}${chaincode_name}${NC}"
    echo -e "${CYAN}│${NC} Version:    ${GREEN}${version}${NC}"
    echo -e "${CYAN}│${NC} Sequence:   ${GREEN}${sequence}${NC}"
    echo -e "${CYAN}│${NC} Channel:    ${GREEN}${channel}${NC}"
    echo -e "${CYAN}│${NC} Package ID: ${GREEN}${package_id:0:50}...${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    
    log_info "Approving chaincode '${chaincode_name}' on channel '${channel}' (version: ${version}, sequence: ${sequence})..."
    
    peer lifecycle chaincode approveformyorg \
        -o ${ORDERER_URL} \
        --channelID ${channel} \
        --name ${chaincode_name} \
        --version ${version} \
        --sequence ${sequence} \
        --waitForEvent \
        --package-id ${package_id}
    
    if [ $? -eq 0 ]; then
        log_success "Approved '${chaincode_name}' on '${channel}' (version: ${version}, sequence: ${sequence})"
    else
        log_error "Failed to approve '${chaincode_name}' on '${channel}'"
        return 1
    fi
}

# Smart approve: automatically decides whether to match committed or use next sequence
# - If chaincode is already committed: match the committed version
# - If chaincode is NOT committed: use next sequence (1 for first time)
approve_chaincode_smart() {
    local channel=$1
    local chaincode_name=$2
    local package_id=$3
    
    # Check if chaincode is already committed
    local committed_seq=$(get_committed_sequence "$channel" "$chaincode_name")
    
    if [ "$committed_seq" == "0" ] || [ -z "$committed_seq" ]; then
        # Not committed yet - use next sequence (will be 1 for first time)
        log_info "Chaincode '${chaincode_name}' not yet committed on '${channel}'. Using next sequence..."
        approve_chaincode "$channel" "$chaincode_name" "$package_id"
    else
        # Already committed - match the committed version
        local version=$(get_committed_version "$channel" "$chaincode_name")
        log_info "Chaincode '${chaincode_name}' already committed on '${channel}'. Matching version ${version}, sequence ${committed_seq}..."
        
        # Display detailed deployment information
        echo ""
        echo -e "${CYAN}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
        echo -e "${CYAN}│${NC} ${YELLOW}APPROVING CHAINCODE (MATCHING COMMITTED)${NC}                              ${CYAN}│${NC}"
        echo -e "${CYAN}├─────────────────────────────────────────────────────────────────────────┤${NC}"
        echo -e "${CYAN}│${NC} Chaincode:  ${GREEN}${chaincode_name}${NC}"
        echo -e "${CYAN}│${NC} Version:    ${GREEN}${version}${NC}"
        echo -e "${CYAN}│${NC} Sequence:   ${GREEN}${committed_seq}${NC}"
        echo -e "${CYAN}│${NC} Channel:    ${GREEN}${channel}${NC}"
        echo -e "${CYAN}│${NC} Package ID: ${GREEN}${package_id:0:50}...${NC}"
        echo -e "${CYAN}│${NC} Status:     ${YELLOW}Matching already committed version${NC}"
        echo -e "${CYAN}└─────────────────────────────────────────────────────────────────────────┘${NC}"
        echo ""
        
        peer lifecycle chaincode approveformyorg \
            -o ${ORDERER_URL} \
            --channelID ${channel} \
            --name ${chaincode_name} \
            --version ${version} \
            --sequence ${committed_seq} \
            --waitForEvent \
            --package-id ${package_id}
        
        if [ $? -eq 0 ]; then
            log_success "Approved '${chaincode_name}' on '${channel}' (version: ${version}, sequence: ${committed_seq})"
        else
            log_error "Failed to approve '${chaincode_name}' on '${channel}'"
            return 1
        fi
    fi
}

commit_chaincode() {
    local channel=$1
    local chaincode_name=$2
    local sequence=${3:-}  # Optional: override sequence
    local version=${4:-}   # Optional: override version
    
    # If sequence/version not provided, calculate them
    if [ -z "$sequence" ]; then
        sequence=$(get_next_sequence "$channel" "$chaincode_name")
    fi
    if [ -z "$version" ]; then
        version=$(get_next_version "$channel" "$chaincode_name")
    fi
    
    # Display detailed deployment information
    echo ""
    echo -e "${CYAN}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${CYAN}│${NC} ${YELLOW}COMMITTING CHAINCODE${NC}                                                 ${CYAN}│${NC}"
    echo -e "${CYAN}├─────────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${CYAN}│${NC} Chaincode:  ${GREEN}${chaincode_name}${NC}"
    echo -e "${CYAN}│${NC} Version:    ${GREEN}${version}${NC}"
    echo -e "${CYAN}│${NC} Sequence:   ${GREEN}${sequence}${NC}"
    echo -e "${CYAN}│${NC} Channel:    ${GREEN}${channel}${NC}"
    echo -e "${CYAN}└─────────────────────────────────────────────────────────────────────────┘${NC}"
    
    log_info "Committing chaincode '${chaincode_name}' on channel '${channel}' (version: ${version}, sequence: ${sequence})..."
    
    peer lifecycle chaincode commit \
        -o ${ORDERER_URL} \
        --channelID ${channel} \
        --name ${chaincode_name} \
        --version ${version} \
        --sequence ${sequence}
    
    if [ $? -eq 0 ]; then
        log_success "Committed '${chaincode_name}' on '${channel}' (version: ${version}, sequence: ${sequence})"
    else
        log_error "Failed to commit '${chaincode_name}' on '${channel}'"
        return 1
    fi
}

check_readiness() {
    local channel=$1
    local chaincode_name=$2
    
    local sequence=$(get_next_sequence "$channel" "$chaincode_name")
    local version=$(get_next_version "$channel" "$chaincode_name")
    
    log_info "Checking commit readiness for '${chaincode_name}' on '${channel}' (version: ${version}, sequence: ${sequence})..."
    
    peer lifecycle chaincode checkcommitreadiness \
        --channelID ${channel} \
        --name ${chaincode_name} \
        --version ${version} \
        --sequence ${sequence}
}

# =============================================================================
# Package ID Setup Functions
# =============================================================================

set_package_ids() {
    if [ -z "$LAWYER_CC_PACKAGE_ID" ]; then
        log_warning "LAWYER_CC_PACKAGE_ID not set. Please export it before running."
    fi
    
    if [ -z "$REGISTRAR_CC_PACKAGE_ID" ]; then
        log_warning "REGISTRAR_CC_PACKAGE_ID not set. Please export it before running."
    fi
    
    if [ -z "$STAMPREPORTER_CC_PACKAGE_ID" ]; then
        log_warning "STAMPREPORTER_CC_PACKAGE_ID not set. Please export it before running."
    fi
    
    if [ -z "$BENCHCLERK_CC_PACKAGE_ID" ]; then
        log_warning "BENCHCLERK_CC_PACKAGE_ID not set. Please export it before running."
    fi
    
    if [ -z "$JUDGE_CC_PACKAGE_ID" ]; then
        log_warning "JUDGE_CC_PACKAGE_ID not set. Please export it before running."
    fi
}

# =============================================================================
# Deployment Functions per Organization
# =============================================================================

# NOTE on Approval Logic:
# - First org to deploy a chaincode on a channel: approve -> commit
# - Second org on same channel: approve_match_committed (uses same version/sequence as committed)
# - For upgrades: both orgs approve with next sequence, then one commits

deploy_lawyer_org() {
    local channel_filter=$1
    
    log_section "Deploying chaincodes for LawyersOrg"
    switch_to_lawyerorg
    
    # Check if this is an upgrade scenario (chaincode already deployed)
    local current_version=$(get_committed_version "lawyer-registrar-channel" "lawyer")
    if [ "$current_version" != "0" ] && [ -n "$current_version" ]; then
        echo ""
        log_error "UPGRADE DETECTED: 'lawyer chaincode' is already deployed (version: ${current_version})"
        echo ""
        echo -e "${RED}The 'deploy' command is ONLY for initial deployment.${NC}"
        echo -e "${RED}It cannot be used for upgrading existing chaincodes.${NC}"
        echo ""
        echo -e "${GREEN}Please use the correct command:${NC}"
        echo ""
        echo -e "  ${CYAN}For NEW code version:${NC}"
        echo -e "    1. Package:  source ./deploy_chaincode.sh package lawyer"
        echo -e "    2. Install:  source ./deploy_chaincode.sh install lawyer"
        echo -e "    3. Upgrade:  source ./deploy_chaincode.sh upgrade lawyer"
        echo ""
        echo -e "  ${CYAN}If you already upgraded on this org but other orgs need to catch up:${NC}"
        echo -e "    source ./deploy_chaincode.sh sync-upgrade lawyer"
        echo ""
        return 1
    fi
    
    # lawyer-registrar-channel: LawyersOrg & RegistrarsOrg
    # LawyersOrg is FIRST for 'lawyer' chaincode, SECOND for 'registrar' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "lawyer-registrar" ]; then
        log_section "LawyersOrg: lawyer-registrar-channel"
        # Lawyer chaincode - LawyersOrg approves and commits first
        approve_chaincode "lawyer-registrar-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID" || return 1
        commit_chaincode "lawyer-registrar-channel" "lawyer" || return 1
        # Registrar chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "lawyer-registrar-channel" "registrar" "$REGISTRAR_CC_PACKAGE_ID" || return 1
    fi
    
    # stampreporter-lawyer-channel: StampReportersOrg & LawyersOrg
    # LawyersOrg is FIRST for 'lawyer' chaincode, SECOND for 'stampreporter' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "stampreporter-lawyer" ]; then
        log_section "LawyersOrg: stampreporter-lawyer-channel"
        # Lawyer chaincode - LawyersOrg approves and commits first
        approve_chaincode "stampreporter-lawyer-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID" || return 1
        commit_chaincode "stampreporter-lawyer-channel" "lawyer" || return 1
        # StampReporter chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "stampreporter-lawyer-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID" || return 1
    fi
    
    # benchclerk-lawyer-channel: BenchClerksOrg & LawyersOrg
    # LawyersOrg is FIRST for 'lawyer' chaincode, SECOND for 'benchclerk' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "benchclerk-lawyer" ]; then
        log_section "LawyersOrg: benchclerk-lawyer-channel"
        # Lawyer chaincode - LawyersOrg approves and commits first
        approve_chaincode "benchclerk-lawyer-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID" || return 1
        commit_chaincode "benchclerk-lawyer-channel" "lawyer" || return 1
        # BenchClerk chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "benchclerk-lawyer-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID" || return 1
    fi
    
    log_success "LawyersOrg deployment complete!"
}

deploy_registrar_org() {
    local channel_filter=$1
    
    log_section "Deploying chaincodes for RegistrarsOrg"
    switch_to_registrarorg
    
    # Check if this is an upgrade scenario
    local current_version=$(get_committed_version "lawyer-registrar-channel" "registrar")
    if [ "$current_version" != "0" ] && [ -n "$current_version" ]; then
        echo ""
        log_error "UPGRADE DETECTED: 'registrar chaincode' is already deployed (version: ${current_version})"
        echo ""
        echo -e "${RED}The 'deploy' command is ONLY for initial deployment.${NC}"
        echo ""
        echo -e "${GREEN}Use instead:${NC}"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh upgrade registrar${NC}   (for new code)"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh sync-upgrade registrar${NC}   (to sync other orgs)"
        echo ""
        return 1
    fi
    
    # lawyer-registrar-channel: LawyersOrg & RegistrarsOrg
    # RegistrarsOrg is FIRST for 'registrar' chaincode, SECOND for 'lawyer' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "lawyer-registrar" ]; then
        log_section "RegistrarsOrg: lawyer-registrar-channel"
        # Registrar chaincode - RegistrarsOrg approves and commits first
        approve_chaincode "lawyer-registrar-channel" "registrar" "$REGISTRAR_CC_PACKAGE_ID"
        commit_chaincode "lawyer-registrar-channel" "registrar"
        # Lawyer chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "lawyer-registrar-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID"
    fi
    
    # registrar-stampreporter-channel: RegistrarsOrg & StampReportersOrg
    # RegistrarsOrg is FIRST for 'registrar' chaincode, SECOND for 'stampreporter' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "registrar-stampreporter" ]; then
        log_section "RegistrarsOrg: registrar-stampreporter-channel"
        # Registrar chaincode - RegistrarsOrg approves and commits first
        approve_chaincode "registrar-stampreporter-channel" "registrar" "$REGISTRAR_CC_PACKAGE_ID"
        commit_chaincode "registrar-stampreporter-channel" "registrar"
        # StampReporter chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "registrar-stampreporter-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
    fi
    
    log_success "RegistrarsOrg deployment complete!"
}

deploy_stampreporter_org() {
    local channel_filter=$1
    
    log_section "Deploying chaincodes for StampReportersOrg"
    switch_to_stampreporterorg
    
    # Check if this is an upgrade scenario
    local current_version=$(get_committed_version "registrar-stampreporter-channel" "stampreporter")
    if [ "$current_version" != "0" ] && [ -n "$current_version" ]; then
        echo ""
        log_error "UPGRADE DETECTED: 'stampreporter' chaincode is already deployed (version: ${current_version})"
        echo ""
        echo -e "${RED}The 'deploy' command is ONLY for initial deployment.${NC}"
        echo ""
        echo -e "${GREEN}Use instead:${NC}"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh upgrade stampreporter${NC}   (for new code)"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh sync-upgrade stampreporter${NC}   (to sync other orgs)"
        echo ""
        return 1
    fi
    
    # registrar-stampreporter-channel: RegistrarsOrg & StampReportersOrg
    # StampReportersOrg is FIRST for 'stampreporter' chaincode, SECOND for 'registrar' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "registrar-stampreporter" ]; then
        log_section "StampReportersOrg: registrar-stampreporter-channel"
        # StampReporter chaincode - StampReportersOrg approves and commits first
        approve_chaincode "registrar-stampreporter-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
        commit_chaincode "registrar-stampreporter-channel" "stampreporter"
        # Registrar chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "registrar-stampreporter-channel" "registrar" "$REGISTRAR_CC_PACKAGE_ID"
    fi
    
    # stampreporter-lawyer-channel: StampReportersOrg & LawyersOrg
    # StampReportersOrg is FIRST for 'stampreporter' chaincode, SECOND for 'lawyer' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "stampreporter-lawyer" ]; then
        log_section "StampReportersOrg: stampreporter-lawyer-channel"
        # StampReporter chaincode - StampReportersOrg approves and commits first
        approve_chaincode "stampreporter-lawyer-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
        commit_chaincode "stampreporter-lawyer-channel" "stampreporter"
        # Lawyer chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "stampreporter-lawyer-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID"
    fi
    
    # stampreporter-benchclerk-channel: StampReportersOrg & BenchClerksOrg
    # StampReportersOrg is FIRST for 'stampreporter' chaincode, SECOND for 'benchclerk' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "stampreporter-benchclerk" ]; then
        log_section "StampReportersOrg: stampreporter-benchclerk-channel"
        # StampReporter chaincode - StampReportersOrg approves and commits first
        approve_chaincode "stampreporter-benchclerk-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
        commit_chaincode "stampreporter-benchclerk-channel" "stampreporter"
        # BenchClerk chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "stampreporter-benchclerk-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
    fi
    
    log_success "StampReportersOrg deployment complete!"
}

deploy_benchclerk_org() {
    local channel_filter=$1
    
    log_section "Deploying chaincodes for BenchClerksOrg"
    switch_to_benchclerkorg
    
    # Check if this is an upgrade scenario
    local current_version=$(get_committed_version "stampreporter-benchclerk-channel" "benchclerk")
    if [ "$current_version" != "0" ] && [ -n "$current_version" ]; then
        echo ""
        log_error "UPGRADE DETECTED: 'benchclerk' chaincode is already deployed (version: ${current_version})"
        echo ""
        echo -e "${RED}The 'deploy' command is ONLY for initial deployment.${NC}"
        echo ""
        echo -e "${GREEN}Use instead:${NC}"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh upgrade benchclerk${NC}   (for new code)"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh sync-upgrade benchclerk${NC}   (to sync other orgs)"
        echo ""
        return 1
    fi
    
    # stampreporter-benchclerk-channel: StampReportersOrg & BenchClerksOrg
    # BenchClerksOrg is FIRST for 'benchclerk' chaincode, SECOND for 'stampreporter' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "stampreporter-benchclerk" ]; then
        log_section "BenchClerksOrg: stampreporter-benchclerk-channel"
        # BenchClerk chaincode - BenchClerksOrg approves and commits first
        approve_chaincode "stampreporter-benchclerk-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
        commit_chaincode "stampreporter-benchclerk-channel" "benchclerk"
        # StampReporter chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "stampreporter-benchclerk-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
    fi
    
    # benchclerk-judge-channel: BenchClerksOrg & JudgesOrg
    # BenchClerksOrg is FIRST for 'benchclerk' chaincode, SECOND for 'judge' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "benchclerk-judge" ]; then
        log_section "BenchClerksOrg: benchclerk-judge-channel"
        # BenchClerk chaincode - BenchClerksOrg approves and commits first
        approve_chaincode "benchclerk-judge-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
        commit_chaincode "benchclerk-judge-channel" "benchclerk"
        # Judge chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "benchclerk-judge-channel" "judge" "$JUDGE_CC_PACKAGE_ID"
    fi
    
    # benchclerk-lawyer-channel: BenchClerksOrg & LawyersOrg
    # BenchClerksOrg is FIRST for 'benchclerk' chaincode, SECOND for 'lawyer' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "benchclerk-lawyer" ]; then
        log_section "BenchClerksOrg: benchclerk-lawyer-channel"
        # BenchClerk chaincode - BenchClerksOrg approves and commits first
        approve_chaincode "benchclerk-lawyer-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
        commit_chaincode "benchclerk-lawyer-channel" "benchclerk"
        # Lawyer chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "benchclerk-lawyer-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID"
    fi
    
    log_success "BenchClerksOrg deployment complete!"
}

deploy_judge_org() {
    local channel_filter=$1
    
    log_section "Deploying chaincodes for JudgesOrg"
    switch_to_judgeorg
    
    # Check if this is an upgrade scenario
    local current_version=$(get_committed_version "benchclerk-judge-channel" "judge")
    if [ "$current_version" != "0" ] && [ -n "$current_version" ]; then
        echo ""
        log_error "UPGRADE DETECTED: 'judge' chaincode is already deployed (version: ${current_version})"
        echo ""
        echo -e "${RED}The 'deploy' command is ONLY for initial deployment.${NC}"
        echo ""
        echo -e "${GREEN}Use instead:${NC}"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh upgrade judge${NC}   (for new code)"
        echo -e "  ${CYAN}source ./deploy_chaincode.sh sync-upgrade judge${NC}   (to sync other orgs)"
        echo ""
        return 1
    fi
    
    # benchclerk-judge-channel: BenchClerksOrg & JudgesOrg
    # JudgesOrg is FIRST for 'judge' chaincode, SECOND for 'benchclerk' chaincode
    if [ -z "$channel_filter" ] || [ "$channel_filter" == "benchclerk-judge" ]; then
        log_section "JudgesOrg: benchclerk-judge-channel"
        # Judge chaincode - JudgesOrg approves and commits first
        approve_chaincode "benchclerk-judge-channel" "judge" "$JUDGE_CC_PACKAGE_ID"
        commit_chaincode "benchclerk-judge-channel" "judge"
        # BenchClerk chaincode - smart approve (matches if committed, else uses next seq)
        approve_chaincode_smart "benchclerk-judge-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
    fi
    
    log_success "JudgesOrg deployment complete!"
}

deploy_all_orgs() {
    log_section "Deploying chaincodes for ALL organizations"
    
    echo ""
    read -p "Deploy for LawyersOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        deploy_lawyer_org
    fi
    
    echo ""
    read -p "Deploy for RegistrarsOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        deploy_registrar_org
    fi
    
    echo ""
    read -p "Deploy for StampReportersOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        deploy_stampreporter_org
    fi
    
    echo ""
    read -p "Deploy for BenchClerksOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        deploy_benchclerk_org
    fi
    
    echo ""
    read -p "Deploy for JudgesOrg? (y/n): " confirm
    if [ "$confirm" == "y" ]; then
        deploy_judge_org
    fi
    
    log_success "All deployments complete!"
}

# =============================================================================
# Global Automated Commands with Interactive Prompts
# =============================================================================
# These functions automate the entire workflow across all organizations.
# They show what's about to happen and wait for Enter to proceed.
# Press 'q' to quit entirely, 's' to skip current step, or Enter to proceed.

# Helper function: prompt for action with skip/quit options
prompt_action() {
    local action_description=$1
    local is_critical=${2:-false}  # If true, quitting here stops everything
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}NEXT ACTION:${NC} $action_description"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}[Enter]${NC} Proceed  |  ${YELLOW}[s]${NC} Skip  |  ${RED}[q]${NC} Quit"
    echo -n "  Your choice: "
    
    read -r choice
    case $choice in
        q|Q)
            log_warning "Quitting automation..."
            return 2  # Return code 2 = quit
            ;;
        s|S)
            log_info "Skipping this step..."
            return 1  # Return code 1 = skip
            ;;
        *)
            return 0  # Return code 0 = proceed
            ;;
    esac
}

# Helper function: prompt on error - continue or terminate
prompt_on_error() {
    local org_name=$1
    local error_context=$2
    
    echo ""
    echo -e "${RED}╔════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                           DEPLOYMENT ERROR                                 ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    log_error "${org_name} deployment FAILED!"
    if [ ! -z "$error_context" ]; then
        echo -e "${YELLOW}Context: ${error_context}${NC}"
    fi
    echo ""
    echo -e "${YELLOW}What would you like to do?${NC}"
    echo -e "  ${GREEN}[c]${NC} Continue with next organization"
    echo -e "  ${RED}[q]${NC} Quit entire deployment process"
    echo -n "  Your choice: "
    
    read -r choice
    case $choice in
        q|Q)
            log_warning "Terminating global deployment process..."
            return 1  # Return code 1 = quit/terminate
            ;;
        c|C|*)
            log_info "Continuing with next organization..."
            return 0  # Return code 0 = continue
            ;;
    esac
}

# =============================================================================
# GLOBAL INSTALL - Install all chaincodes on all organizations
# =============================================================================
global_install() {
    log_section "GLOBAL INSTALL - Installing Chaincodes on ALL Organizations"
    echo ""
    echo -e "${CYAN}This will install all required chaincodes on each organization's peer.${NC}"
    echo -e "${CYAN}The process will auto-switch between organizations.${NC}"
    echo ""
    
    # LawyersOrg
    prompt_action "Switch to LawyersOrg and install 4 chaincode packages:
      • lawyer chaincode (owner - will deploy on 3 channels)
      • registrar chaincode (needed for lawyer-registrar-channel)
      • stampreporter chaincode (needed for stampreporter-lawyer-channel)
      • benchclerk chaincode (needed for benchclerk-lawyer-channel)"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        local lawyer_pkg=$(get_latest_package "lawyer")
        local registrar_pkg=$(get_latest_package "registrar")
        local stampreporter_pkg=$(get_latest_package "stampreporter")
        local benchclerk_pkg=$(get_latest_package "benchclerk")
        
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
        install_chaincode_interactive "registrar" "$registrar_pkg"
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
        log_success "LawyersOrg installation complete!"
    fi
    
    # RegistrarsOrg
    prompt_action "Switch to RegistrarsOrg and install 3 chaincode packages:
      • registrar chaincode (owner - will deploy on 2 channels)
      • lawyer chaincode (needed for lawyer-registrar-channel)
      • stampreporter chaincode (needed for registrar-stampreporter-channel)"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        local registrar_pkg=$(get_latest_package "registrar")
        local lawyer_pkg=$(get_latest_package "lawyer")
        local stampreporter_pkg=$(get_latest_package "stampreporter")
        
        install_chaincode_interactive "registrar" "$registrar_pkg"
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
        log_success "RegistrarsOrg installation complete!"
    fi
    
    # StampReportersOrg
    prompt_action "Switch to StampReportersOrg and install 4 chaincode packages:
      • stampreporter chaincode (owner - will deploy on 3 channels)
      • registrar chaincode (needed for registrar-stampreporter-channel)
      • lawyer chaincode (needed for stampreporter-lawyer-channel)
      • benchclerk chaincode (needed for stampreporter-benchclerk-channel)"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        local stampreporter_pkg=$(get_latest_package "stampreporter")
        local registrar_pkg=$(get_latest_package "registrar")
        local lawyer_pkg=$(get_latest_package "lawyer")
        local benchclerk_pkg=$(get_latest_package "benchclerk")
        
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
        install_chaincode_interactive "registrar" "$registrar_pkg"
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
        log_success "StampReportersOrg installation complete!"
    fi
    
    # BenchClerksOrg
    prompt_action "Switch to BenchClerksOrg and install 4 chaincode packages:
      • benchclerk chaincode (owner - will deploy on 3 channels)
      • stampreporter chaincode (needed for stampreporter-benchclerk-channel)
      • judge chaincode (needed for benchclerk-judge-channel)
      • lawyer chaincode (needed for benchclerk-lawyer-channel)"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        local benchclerk_pkg=$(get_latest_package "benchclerk")
        local stampreporter_pkg=$(get_latest_package "stampreporter")
        local judge_pkg=$(get_latest_package "judge")
        local lawyer_pkg=$(get_latest_package "lawyer")
        
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
        install_chaincode_interactive "judge" "$judge_pkg"
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
        log_success "BenchClerksOrg installation complete!"
    fi
    
    # JudgesOrg
    prompt_action "Switch to JudgesOrg and install 2 chaincode packages:
      • judge chaincode (owner - will deploy on 1 channel)
      • benchclerk chaincode (needed for benchclerk-judge-channel)"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_judgeorg
        local judge_pkg=$(get_latest_package "judge")
        local benchclerk_pkg=$(get_latest_package "benchclerk")
        
        install_chaincode_interactive "judge" "$judge_pkg"
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
        log_success "JudgesOrg installation complete!"
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  GLOBAL INSTALL COMPLETE - All organizations have chaincodes installed!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# =============================================================================
# GLOBAL DEPLOY - Initial deployment on all organizations (FIRST TIME ONLY)
# =============================================================================
global_deploy() {
    log_section "GLOBAL DEPLOY - Initial Chaincode Deployment on ALL Organizations"
    echo ""
    echo -e "${RED}⚠️  WARNING: This is for FIRST TIME deployment only!${NC}"
    echo -e "${RED}   If chaincodes are already deployed, use 'global-upgrade' instead.${NC}"
    echo ""
    echo -e "${YELLOW}⚠️  PREREQUISITE: All channels MUST exist before deploying chaincodes!${NC}"
    echo -e "${YELLOW}   MicroFab should automatically create channels based on MICROFAB.txt config.${NC}"
    echo -e "${YELLOW}   If you see 'channel not found' errors, verify MicroFab is running correctly.${NC}"
    echo ""
    
    set_package_ids
    
    # LawyersOrg
    prompt_action "Switch to LawyersOrg and deploy:
      • Lawyer chaincode: approve + commit on 3 channels (lawyer-registrar-channel, stampreporter-lawyer-channel, benchclerk-lawyer-channel)
      • Registrar chaincode: approve on lawyer-registrar-channel
      • Stampreporter chaincode: approve on stampreporter-lawyer-channel
      • Benchclerk chaincode: approve on benchclerk-lawyer-channel"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        if ! deploy_lawyer_org; then
            if ! prompt_on_error "LawyersOrg" "Failed to deploy chaincodes on LawyersOrg"; then
                return 1  # User chose to quit
            fi
        fi
    fi
    
    # RegistrarsOrg
    prompt_action "Switch to RegistrarsOrg and deploy:
      • Registrar chaincode: approve + commit on 2 channels (lawyer-registrar-channel, registrar-stampreporter-channel)
      • Lawyer chaincode: approve on lawyer-registrar-channel
      • Stampreporter chaincode: approve on registrar-stampreporter-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        if ! deploy_registrar_org; then
            if ! prompt_on_error "RegistrarsOrg" "Failed to deploy chaincodes on RegistrarsOrg"; then
                return 1  # User chose to quit
            fi
        fi
    fi
    
    # StampReportersOrg
    prompt_action "Switch to StampReportersOrg and deploy:
      • Stampreporter chaincode: approve + commit on 3 channels (registrar-stampreporter-channel, stampreporter-lawyer-channel, stampreporter-benchclerk-channel)
      • Registrar chaincode: approve on registrar-stampreporter-channel
      • Lawyer chaincode: approve on stampreporter-lawyer-channel
      • Benchclerk chaincode: approve on stampreporter-benchclerk-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        if ! deploy_stampreporter_org; then
            if ! prompt_on_error "StampReportersOrg" "Failed to deploy chaincodes on StampReportersOrg"; then
                return 1  # User chose to quit
            fi
        fi
    fi
    
    # BenchClerksOrg
    prompt_action "Switch to BenchClerksOrg and deploy:
      • Benchclerk chaincode: approve + commit on 3 channels (stampreporter-benchclerk-channel, benchclerk-judge-channel, benchclerk-lawyer-channel)
      • Stampreporter chaincode: approve on stampreporter-benchclerk-channel
      • Judge chaincode: approve on benchclerk-judge-channel
      • Lawyer chaincode: approve on benchclerk-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        if ! deploy_benchclerk_org; then
            if ! prompt_on_error "BenchClerksOrg" "Failed to deploy chaincodes on BenchClerksOrg"; then
                return 1  # User chose to quit
            fi
        fi
    fi
    
    # JudgesOrg
    prompt_action "Switch to JudgesOrg and deploy:
      • Judge chaincode: approve + commit on 1 channel (benchclerk-judge-channel)
      • Benchclerk chaincode: approve on benchclerk-judge-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        if ! deploy_judge_org; then
            if ! prompt_on_error "JudgesOrg" "Failed to deploy chaincodes on JudgesOrg"; then
                return 1  # User chose to quit
            fi
        fi
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  GLOBAL DEPLOY COMPLETE - All chaincodes deployed on all organizations!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# =============================================================================
# GLOBAL UPGRADE - Upgrade a specific chaincode across all required orgs
# =============================================================================
global_upgrade() {
    local chaincode_name=$1
    
    if [ -z "$chaincode_name" ]; then
        log_error "Usage: global-upgrade <chaincode>"
        echo "  Valid chaincodes: lawyer, registrar, stampreporter, benchclerk, judge"
        return 1
    fi
    
    log_section "GLOBAL UPGRADE - Upgrading '${chaincode_name}' chaincode across all organizations"
    echo ""
    echo -e "${CYAN}This will:${NC}"
    echo -e "  1. Install the new package on all orgs that need it"
    echo -e "  2. Approve the upgrade on all orgs"
    echo -e "  3. Commit the upgrade from the owner org"
    echo ""
    
    set_package_ids
    
    case $chaincode_name in
        lawyer)
            global_upgrade_lawyer
            ;;
        registrar)
            global_upgrade_registrar
            ;;
        stampreporter)
            global_upgrade_stampreporter
            ;;
        benchclerk)
            global_upgrade_benchclerk
            ;;
        judge)
            global_upgrade_judge
            ;;
        *)
            log_error "Unknown chaincode: $chaincode_name"
            echo "Valid options: lawyer, registrar, stampreporter, benchclerk, judge"
            return 1
            ;;
    esac
}

# Upgrade lawyer chaincode globally
global_upgrade_lawyer() {
    log_info "Lawyer chaincode is used on: lawyer-registrar-channel, stampreporter-lawyer-channel, benchclerk-lawyer-channel"
    log_info "Organizations that need it: LawyersOrg (owner), RegistrarsOrg, StampReportersOrg, BenchClerksOrg"
    echo ""
    
    local lawyer_pkg=$(get_latest_package "lawyer")
    
    # Step 1: Install on LawyersOrg (owner)
    prompt_action "Step 1/8: Switch to LawyersOrg and install new lawyer package"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
    fi
    
    # Step 2: Approve on LawyersOrg for all channels
    prompt_action "Step 2/8: Approve lawyer chaincode on LawyersOrg on 3 channels:
      • lawyer-registrar-channel
      • stampreporter-lawyer-channel
      • benchclerk-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        approve_chaincode "lawyer-registrar-channel" "lawyer" "$LAWYER_PACKAGE_ID"
        approve_chaincode "stampreporter-lawyer-channel" "lawyer" "$LAWYER_PACKAGE_ID"
        approve_chaincode "benchclerk-lawyer-channel" "lawyer" "$LAWYER_PACKAGE_ID"
    fi
    
    # Step 3: Install on RegistrarsOrg
    prompt_action "Step 3/8: Switch to RegistrarsOrg and install new lawyer package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
    fi
    
    # Step 4: Approve on RegistrarsOrg
    prompt_action "Step 4/8: Approve lawyer chaincode on RegistrarsOrg:
      • lawyer-registrar-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        approve_chaincode "lawyer-registrar-channel" "lawyer" "$LAWYER_PACKAGE_ID"
    fi
    
    # Step 5: Install on StampReportersOrg
    prompt_action "Step 5/8: Switch to StampReportersOrg and install new lawyer package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
    fi
    
    # Step 6: Approve on StampReportersOrg
    prompt_action "Step 6/8: Approve lawyer chaincode on StampReportersOrg:
      • stampreporter-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        approve_chaincode "stampreporter-lawyer-channel" "lawyer" "$LAWYER_PACKAGE_ID"
    fi
    
    # Step 7: Install on BenchClerksOrg
    prompt_action "Step 7/8: Switch to BenchClerksOrg and install new lawyer package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        install_chaincode_interactive "lawyer" "$lawyer_pkg"
    fi
    
    # Step 8: Approve on BenchClerksOrg and Commit
    prompt_action "Step 8/8: Approve on BenchClerksOrg and COMMIT upgrade from LawyersOrg:
      • Approve: benchclerk-lawyer-channel
      • Commit all 3 channels: lawyer-registrar-channel, stampreporter-lawyer-channel, benchclerk-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        approve_chaincode "benchclerk-lawyer-channel" "lawyer" "$LAWYER_PACKAGE_ID"
        
        # Commit from owner org
        switch_to_lawyerorg
        commit_chaincode "lawyer-registrar-channel" "lawyer"
        commit_chaincode "stampreporter-lawyer-channel" "lawyer"
        commit_chaincode "benchclerk-lawyer-channel" "lawyer"
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  LAWYER CHAINCODE UPGRADE COMPLETE!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# Upgrade registrar chaincode globally
global_upgrade_registrar() {
    log_info "Registrar chaincode is used on: lawyer-registrar-channel, registrar-stampreporter-channel"
    log_info "Organizations that need it: RegistrarsOrg (owner), LawyersOrg, StampReportersOrg"
    echo ""
    
    local registrar_pkg=$(get_latest_package "registrar")
    
    # Step 1: Install on RegistrarsOrg (owner)
    prompt_action "Step 1/6: Switch to RegistrarsOrg and install new registrar package"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        install_chaincode_interactive "registrar" "$registrar_pkg"
    fi
    
    # Step 2: Approve on RegistrarsOrg for all channels
    prompt_action "Step 2/6: Approve registrar chaincode on RegistrarsOrg on 2 channels:
      • lawyer-registrar-channel
      • registrar-stampreporter-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        approve_chaincode "lawyer-registrar-channel" "registrar" "$REGISTRAR_PACKAGE_ID"
        approve_chaincode "registrar-stampreporter-channel" "registrar" "$REGISTRAR_PACKAGE_ID"
    fi
    
    # Step 3: Install on LawyersOrg
    prompt_action "Step 3/6: Switch to LawyersOrg and install new registrar package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        install_chaincode_interactive "registrar" "$registrar_pkg"
    fi
    
    # Step 4: Approve on LawyersOrg
    prompt_action "Step 4/6: Approve registrar chaincode on LawyersOrg:
      • lawyer-registrar-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        approve_chaincode "lawyer-registrar-channel" "registrar" "$REGISTRAR_PACKAGE_ID"
    fi
    
    # Step 5: Install on StampReportersOrg
    prompt_action "Step 5/6: Switch to StampReportersOrg and install new registrar package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        install_chaincode_interactive "registrar" "$registrar_pkg"
    fi
    
    # Step 6: Approve on StampReportersOrg and Commit
    prompt_action "Step 6/6: Approve on StampReportersOrg and COMMIT upgrade from RegistrarsOrg:
      • Approve: registrar-stampreporter-channel
      • Commit both channels: lawyer-registrar-channel, registrar-stampreporter-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        approve_chaincode "registrar-stampreporter-channel" "registrar" "$REGISTRAR_PACKAGE_ID"
        
        # Commit from owner org
        switch_to_registrarorg
        commit_chaincode "lawyer-registrar-channel" "registrar"
        commit_chaincode "registrar-stampreporter-channel" "registrar"
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  REGISTRAR CHAINCODE UPGRADE COMPLETE!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# Upgrade stampreporter chaincode globally
global_upgrade_stampreporter() {
    log_info "StampReporter chaincode is used on: registrar-stampreporter-channel, stampreporter-lawyer-channel, stampreporter-benchclerk-channel"
    log_info "Organizations that need it: StampReportersOrg (owner), RegistrarsOrg, LawyersOrg, BenchClerksOrg"
    echo ""
    
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    
    # Step 1: Install on StampReportersOrg (owner)
    prompt_action "Step 1/8: Switch to StampReportersOrg and install new stampreporter package"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    fi
    
    # Step 2: Approve on StampReportersOrg for all channels
    prompt_action "Step 2/8: Approve stampreporter chaincode on StampReportersOrg on 3 channels:
      • registrar-stampreporter-channel
      • stampreporter-lawyer-channel
      • stampreporter-benchclerk-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        approve_chaincode "registrar-stampreporter-channel" "stampreporter" "$STAMPREPORTER_PACKAGE_ID"
        approve_chaincode "stampreporter-lawyer-channel" "stampreporter" "$STAMPREPORTER_PACKAGE_ID"
        approve_chaincode "stampreporter-benchclerk-channel" "stampreporter" "$STAMPREPORTER_PACKAGE_ID"
    fi
    
    # Step 3: Install on RegistrarsOrg
    prompt_action "Step 3/8: Switch to RegistrarsOrg and install new stampreporter package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    fi
    
    # Step 4: Approve on RegistrarsOrg
    prompt_action "Step 4/8: Approve stampreporter chaincode on RegistrarsOrg:
      • registrar-stampreporter-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_registrarorg
        approve_chaincode "registrar-stampreporter-channel" "stampreporter" "$STAMPREPORTER_PACKAGE_ID"
    fi
    
    # Step 5: Install on LawyersOrg
    prompt_action "Step 5/8: Switch to LawyersOrg and install new stampreporter package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    fi
    
    # Step 6: Approve on LawyersOrg
    prompt_action "Step 6/8: Approve stampreporter chaincode on LawyersOrg:
      • stampreporter-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        approve_chaincode "stampreporter-lawyer-channel" "stampreporter" "$STAMPREPORTER_PACKAGE_ID"
    fi
    
    # Step 7: Install on BenchClerksOrg
    prompt_action "Step 7/8: Switch to BenchClerksOrg and install new stampreporter package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        install_chaincode_interactive "stampreporter" "$stampreporter_pkg"
    fi
    
    # Step 8: Approve on BenchClerksOrg and Commit
    prompt_action "Step 8/8: Approve on BenchClerksOrg and COMMIT upgrade from StampReportersOrg:
      • Approve: stampreporter-benchclerk-channel
      • Commit all 3 channels: registrar-stampreporter-channel, stampreporter-lawyer-channel, stampreporter-benchclerk-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        approve_chaincode "stampreporter-benchclerk-channel" "stampreporter" "$STAMPREPORTER_PACKAGE_ID"
        
        # Commit from owner org
        switch_to_stampreporterorg
        commit_chaincode "registrar-stampreporter-channel" "stampreporter"
        commit_chaincode "stampreporter-lawyer-channel" "stampreporter"
        commit_chaincode "stampreporter-benchclerk-channel" "stampreporter"
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  STAMPREPORTER CHAINCODE UPGRADE COMPLETE!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# Upgrade benchclerk chaincode globally
global_upgrade_benchclerk() {
    log_info "BenchClerk chaincode is used on: stampreporter-benchclerk-channel, benchclerk-judge-channel, benchclerk-lawyer-channel"
    log_info "Organizations that need it: BenchClerksOrg (owner), StampReportersOrg, JudgesOrg, LawyersOrg"
    echo ""
    
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    
    # Step 1: Install on BenchClerksOrg (owner)
    prompt_action "Step 1/8: Switch to BenchClerksOrg and install new benchclerk package"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    fi
    
    # Step 2: Approve on BenchClerksOrg for all channels
    prompt_action "Step 2/8: Approve benchclerk chaincode on BenchClerksOrg on 3 channels:
      • stampreporter-benchclerk-channel
      • benchclerk-judge-channel
      • benchclerk-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        approve_chaincode "stampreporter-benchclerk-channel" "benchclerk" "$BENCHCLERK_PACKAGE_ID"
        approve_chaincode "benchclerk-judge-channel" "benchclerk" "$BENCHCLERK_PACKAGE_ID"
        approve_chaincode "benchclerk-lawyer-channel" "benchclerk" "$BENCHCLERK_PACKAGE_ID"
    fi
    
    # Step 3: Install on StampReportersOrg
    prompt_action "Step 3/8: Switch to StampReportersOrg and install new benchclerk package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    fi
    
    # Step 4: Approve on StampReportersOrg
    prompt_action "Step 4/8: Approve benchclerk chaincode on StampReportersOrg:
      • stampreporter-benchclerk-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_stampreporterorg
        approve_chaincode "stampreporter-benchclerk-channel" "benchclerk" "$BENCHCLERK_PACKAGE_ID"
    fi
    
    # Step 5: Install on JudgesOrg
    prompt_action "Step 5/8: Switch to JudgesOrg and install new benchclerk package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_judgeorg
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    fi
    
    # Step 6: Approve on JudgesOrg
    prompt_action "Step 6/8: Approve benchclerk chaincode on JudgesOrg:
      • benchclerk-judge-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_judgeorg
        approve_chaincode "benchclerk-judge-channel" "benchclerk" "$BENCHCLERK_PACKAGE_ID"
    fi
    
    # Step 7: Install on LawyersOrg
    prompt_action "Step 7/8: Switch to LawyersOrg and install new benchclerk package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        install_chaincode_interactive "benchclerk" "$benchclerk_pkg"
    fi
    
    # Step 8: Approve on LawyersOrg and Commit
    prompt_action "Step 8/8: Approve on LawyersOrg and COMMIT upgrade from BenchClerksOrg:
      • Approve: benchclerk-lawyer-channel
      • Commit all 3 channels: stampreporter-benchclerk-channel, benchclerk-judge-channel, benchclerk-lawyer-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_lawyerorg
        approve_chaincode "benchclerk-lawyer-channel" "benchclerk" "$BENCHCLERK_PACKAGE_ID"
        
        # Commit from owner org
        switch_to_benchclerkorg
        commit_chaincode "stampreporter-benchclerk-channel" "benchclerk"
        commit_chaincode "benchclerk-judge-channel" "benchclerk"
        commit_chaincode "benchclerk-lawyer-channel" "benchclerk"
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  BENCHCLERK CHAINCODE UPGRADE COMPLETE!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# Upgrade judge chaincode globally
global_upgrade_judge() {
    log_info "Judge chaincode is used on: benchclerk-judge-channel"
    log_info "Organizations that need it: JudgesOrg (owner), BenchClerksOrg"
    echo ""
    
    local judge_pkg=$(get_latest_package "judge")
    
    # Step 1: Install on JudgesOrg (owner)
    prompt_action "Step 1/4: Switch to JudgesOrg and install new judge package"
    local result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_judgeorg
        install_chaincode_interactive "judge" "$judge_pkg"
    fi
    
    # Step 2: Approve on JudgesOrg
    prompt_action "Step 2/4: Approve judge chaincode on JudgesOrg:
      • benchclerk-judge-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_judgeorg
        approve_chaincode "benchclerk-judge-channel" "judge" "$JUDGE_PACKAGE_ID"
    fi
    
    # Step 3: Install on BenchClerksOrg
    prompt_action "Step 3/4: Switch to BenchClerksOrg and install new judge package"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        install_chaincode_interactive "judge" "$judge_pkg"
    fi
    
    # Step 4: Approve on BenchClerksOrg and Commit
    prompt_action "Step 4/4: Approve on BenchClerksOrg and COMMIT upgrade from JudgesOrg:
      • Approve: benchclerk-judge-channel
      • Commit: benchclerk-judge-channel"
    result=$?
    if [ $result -eq 2 ]; then return 0; fi
    if [ $result -eq 0 ]; then
        switch_to_benchclerkorg
        approve_chaincode "benchclerk-judge-channel" "judge" "$JUDGE_PACKAGE_ID"
        
        # Commit from owner org
        switch_to_judgeorg
        commit_chaincode "benchclerk-judge-channel" "judge"
    fi
    
    echo ""
    log_success "═══════════════════════════════════════════════════════════════════════════"
    log_success "  JUDGE CHAINCODE UPGRADE COMPLETE!"
    log_success "═══════════════════════════════════════════════════════════════════════════"
}

# =============================================================================
# Query Functions
# =============================================================================

query_all_committed() {
    log_section "Querying committed chaincodes on all channels"
    
    switch_to_lawyerorg
    
    local channels=(
        "lawyer-registrar-channel"
        "registrar-stampreporter-channel"
        "stampreporter-lawyer-channel"
        "stampreporter-benchclerk-channel"
        "benchclerk-judge-channel"
        "benchclerk-lawyer-channel"
    )
    
    for channel in "${channels[@]}"; do
        echo ""
        echo -e "${CYAN}Channel: ${channel}${NC}"
        echo "----------------------------------------"
        peer lifecycle chaincode querycommitted --channelID ${channel} 2>/dev/null || echo "  No access or no chaincodes committed"
    done
}

query_installed() {
    log_section "Querying installed chaincodes on current peer"
    peer lifecycle chaincode queryinstalled
}

# =============================================================================
# Automated Upgrade Helper Functions
# =============================================================================

# Automate install and approve for a single org
automate_org_upgrade() {
    local org=$1
    local chaincode_name=$2
    local channel=$3
    local package_file=$4
    
    log_section "Automating upgrade for ${org}Org"
    
    # Switch to org
    log_info "Switching to ${org}Org..."
    switch_org "$org"
    
    # Install chaincode
    log_info "Installing ${chaincode_name} chaincode on ${org}Org..."
    install_chaincode_interactive "$chaincode_name" "$package_file"
    
    # Approve on channel
    local package_id_var="${chaincode_name^^}_CC_PACKAGE_ID"
    local package_id="${!package_id_var}"
    
    if [ -z "$package_id" ]; then
        log_error "Package ID not exported for ${chaincode_name}. Cannot approve."
        return 1
    fi
    
    log_info "Approving ${chaincode_name} on ${channel}..."
    approve_chaincode_smart "$channel" "$chaincode_name" "$package_id"
    
    log_success "${org}Org upgrade complete!"
}

# Prompt user for manual or automated approval process
prompt_upgrade_automation() {
    local chaincode_name=$1
    shift
    local orgs_channels=("$@")  # Array of "org:channel" pairs
    
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Upgrade Approval Options${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "The ${CYAN}${chaincode_name}${NC} chaincode has been upgraded on the owner org."
    echo "Other organizations on shared channels need to approve this upgrade."
    echo ""
    echo -e "${GREEN}Choose an option:${NC}"
    echo "  1) Manual - Show me the commands to run"
    echo "  2) Automatic - Run installation and approval automatically"
    echo ""
    read -p "Enter your choice (1 or 2): " choice
    
    case $choice in
        1)
            return 1  # Manual mode
            ;;
        2)
            return 0  # Automatic mode
            ;;
        *)
            log_warning "Invalid choice. Defaulting to manual mode."
            return 1
            ;;
    esac
}

# =============================================================================
# Selective/Upgrade Deployment Functions
# =============================================================================
# These functions allow deploying a SPECIFIC chaincode across its channels
# without touching other chaincodes. Useful for upgrades.
#
# Chaincode -> Channels mapping:
#   lawyer:       lawyer-registrar-channel, stampreporter-lawyer-channel, benchclerk-lawyer-channel
#   registrar:    lawyer-registrar-channel, registrar-stampreporter-channel
#   stampreporter: registrar-stampreporter-channel, stampreporter-lawyer-channel, stampreporter-benchclerk-channel
#   benchclerk:   stampreporter-benchclerk-channel, benchclerk-judge-channel, benchclerk-lawyer-channel
#   judge:        benchclerk-judge-channel
#
# Chaincode -> Orgs that need it installed:
#   lawyer:       LawyersOrg, RegistrarsOrg, StampReportersOrg, BenchClerksOrg
#   registrar:    RegistrarsOrg, LawyersOrg, StampReportersOrg
#   stampreporter: StampReportersOrg, RegistrarsOrg, LawyersOrg, BenchClerksOrg
#   benchclerk:   BenchClerksOrg, StampReportersOrg, JudgesOrg, LawyersOrg
#   judge:        JudgesOrg, BenchClerksOrg

# Deploy/upgrade a specific chaincode on all its channels from the owning org
# This approves, commits on self-org channels
upgrade_lawyer_chaincode() {
    log_section "Upgrading LAWYER CHAINCODE on all channels"
    log_info "Channels: lawyer-registrar-channel, stampreporter-lawyer-channel, benchclerk-lawyer-channel"
    log_info "Owner: LawyersOrg (will approve + commit)"
    log_info "Other orgs needing approval: RegistrarsOrg, StampReportersOrg, BenchClerksOrg"
    
    switch_to_lawyerorg
    
    # lawyer-registrar-channel
    log_section "Upgrading lawyer on lawyer-registrar-channel"
    approve_chaincode "lawyer-registrar-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID"
    commit_chaincode "lawyer-registrar-channel" "lawyer"
    
    # stampreporter-lawyer-channel
    log_section "Upgrading lawyer on stampreporter-lawyer-channel"
    approve_chaincode "stampreporter-lawyer-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID"
    commit_chaincode "stampreporter-lawyer-channel" "lawyer"
    
    # benchclerk-lawyer-channel
    log_section "Upgrading lawyer on benchclerk-lawyer-channel"
    approve_chaincode "benchclerk-lawyer-channel" "lawyer" "$LAWYER_CC_PACKAGE_ID"
    commit_chaincode "benchclerk-lawyer-channel" "lawyer"
    
    log_success "LAWYER chaincode upgraded on all channels!"
    
    # Get latest package file
    local lawyer_pkg=$(get_latest_package "lawyer")
    
    # Prompt for automation
    if prompt_upgrade_automation "lawyer" "registrar:lawyer-registrar-channel" "stampreporter:stampreporter-lawyer-channel" "benchclerk:benchclerk-lawyer-channel"; then
        log_section "Starting Automated Upgrade Approval Process"
        
        # Automate for RegistrarsOrg
        automate_org_upgrade "registrar" "lawyer" "lawyer-registrar-channel" "$lawyer_pkg"
        
        # Automate for StampReportersOrg
        automate_org_upgrade "stampreporter" "lawyer" "stampreporter-lawyer-channel" "$lawyer_pkg"
        
        # Automate for BenchClerksOrg
        automate_org_upgrade "benchclerk" "lawyer" "benchclerk-lawyer-channel" "$lawyer_pkg"
        
        log_success "Automated upgrade approval complete for all organizations!"
    else
        # Manual mode - show commands
        echo ""
        log_section "MANUAL MODE: Install and Approve on Other Orgs"
        echo ""
        log_info "Step 1: Switch to org and install the new 'lawyer' chaincode package:"
        echo ""
        echo -e "  ${CYAN}# RegistrarsOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch registrar"
        echo -e "  source ./deploy_chaincode.sh install registrar"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch stampreporter"
        echo -e "  source ./deploy_chaincode.sh install stampreporter"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch benchclerk"
        echo -e "  source ./deploy_chaincode.sh install benchclerk"
        echo ""
        log_info "Step 2: After installation, approve the upgrade on each org:"
        echo ""
        echo -e "  ${CYAN}# RegistrarsOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode registrar lawyer lawyer-registrar-channel"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode stampreporter lawyer stampreporter-lawyer-channel"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode benchclerk lawyer benchclerk-lawyer-channel"
    fi
}

upgrade_registrar_chaincode() {
    log_section "Upgrading REGISTRAR CHAINCODE on all channels"
    log_info "Channels: lawyer-registrar-channel, registrar-stampreporter-channel"
    log_info "Owner: RegistrarsOrg (will approve + commit)"
    log_info "Other orgs needing approval: LawyersOrg, StampReportersOrg"
    
    switch_to_registrarorg
    
    # lawyer-registrar-channel
    log_section "Upgrading registrar on lawyer-registrar-channel"
    approve_chaincode "lawyer-registrar-channel" "registrar" "$REGISTRAR_CC_PACKAGE_ID"
    commit_chaincode "lawyer-registrar-channel" "registrar"
    
    # registrar-stampreporter-channel
    log_section "Upgrading registrar on registrar-stampreporter-channel"
    approve_chaincode "registrar-stampreporter-channel" "registrar" "$REGISTRAR_CC_PACKAGE_ID"
    commit_chaincode "registrar-stampreporter-channel" "registrar"
    
    log_success "REGISTRAR chaincode upgraded on all channels!"
    
    # Get latest package file
    local registrar_pkg=$(get_latest_package "registrar")
    
    # Prompt for automation
    if prompt_upgrade_automation "registrar" "lawyer:lawyer-registrar-channel" "stampreporter:registrar-stampreporter-channel"; then
        log_section "Starting Automated Upgrade Approval Process"
        
        # Automate for LawyersOrg
        automate_org_upgrade "lawyer" "registrar" "lawyer-registrar-channel" "$registrar_pkg"
        
        # Automate for StampReportersOrg
        automate_org_upgrade "stampreporter" "registrar" "registrar-stampreporter-channel" "$registrar_pkg"
        
        log_success "Automated upgrade approval complete for all organizations!"
    else
        # Manual mode - show commands
        echo ""
        log_section "MANUAL MODE: Install and Approve on Other Orgs"
        echo ""
        log_info "Step 1: Switch to org and install the new 'registrar' chaincode package:"
        echo ""
        echo -e "  ${CYAN}# LawyersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch lawyer"
        echo -e "  source ./deploy_chaincode.sh install lawyer"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch stampreporter"
        echo -e "  source ./deploy_chaincode.sh install stampreporter"
        echo ""
        log_info "Step 2: After installation, approve the upgrade on each org:"
        echo ""
        echo -e "  ${CYAN}# LawyersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode lawyer registrar lawyer-registrar-channel"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode stampreporter registrar registrar-stampreporter-channel"
    fi
}

upgrade_stampreporter_chaincode() {
    log_section "Upgrading STAMPREPORTER CHAINCODE on all channels"
    log_info "Channels: registrar-stampreporter-channel, stampreporter-lawyer-channel, stampreporter-benchclerk-channel"
    log_info "Owner: StampReportersOrg (will approve + commit)"
    log_info "Other orgs needing approval: RegistrarsOrg, LawyersOrg, BenchClerksOrg"
    
    switch_to_stampreporterorg
    
    # registrar-stampreporter-channel
    log_section "Upgrading stampreporter on registrar-stampreporter-channel"
    approve_chaincode "registrar-stampreporter-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
    commit_chaincode "registrar-stampreporter-channel" "stampreporter"
    
    # stampreporter-lawyer-channel
    log_section "Upgrading stampreporter on stampreporter-lawyer-channel"
    approve_chaincode "stampreporter-lawyer-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
    commit_chaincode "stampreporter-lawyer-channel" "stampreporter"
    
    # stampreporter-benchclerk-channel
    log_section "Upgrading stampreporter on stampreporter-benchclerk-channel"
    approve_chaincode "stampreporter-benchclerk-channel" "stampreporter" "$STAMPREPORTER_CC_PACKAGE_ID"
    commit_chaincode "stampreporter-benchclerk-channel" "stampreporter"
    
    log_success "STAMPREPORTER chaincode upgraded on all channels!"
    
    # Get latest package file
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    
    # Prompt for automation
    if prompt_upgrade_automation "stampreporter" "registrar:registrar-stampreporter-channel" "lawyer:stampreporter-lawyer-channel" "benchclerk:stampreporter-benchclerk-channel"; then
        log_section "Starting Automated Upgrade Approval Process"
        
        # Automate for RegistrarsOrg
        automate_org_upgrade "registrar" "stampreporter" "registrar-stampreporter-channel" "$stampreporter_pkg"
        
        # Automate for LawyersOrg
        automate_org_upgrade "lawyer" "stampreporter" "stampreporter-lawyer-channel" "$stampreporter_pkg"
        
        # Automate for BenchClerksOrg
        automate_org_upgrade "benchclerk" "stampreporter" "stampreporter-benchclerk-channel" "$stampreporter_pkg"
        
        log_success "Automated upgrade approval complete for all organizations!"
    else
        # Manual mode - show commands
        echo ""
        log_section "MANUAL MODE: Install and Approve on Other Orgs"
        echo ""
        log_info "Step 1: Switch to org and install the new 'stampreporter' chaincode package:"
        echo ""
        echo -e "  ${CYAN}# RegistrarsOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch registrar"
        echo -e "  source ./deploy_chaincode.sh install registrar"
        echo ""
        echo -e "  ${CYAN}# LawyersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch lawyer"
        echo -e "  source ./deploy_chaincode.sh install lawyer"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch benchclerk"
        echo -e "  source ./deploy_chaincode.sh install benchclerk"
        echo ""
        log_info "Step 2: After installation, approve the upgrade on each org:"
        echo ""
        echo -e "  ${CYAN}# RegistrarsOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode registrar stampreporter registrar-stampreporter-channel"
        echo ""
        echo -e "  ${CYAN}# LawyersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode lawyer stampreporter stampreporter-lawyer-channel"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode benchclerk stampreporter stampreporter-benchclerk-channel"
    fi
}

upgrade_benchclerk_chaincode() {
    log_section "Upgrading BENCHCLERK CHAINCODE on all channels"
    log_info "Channels: stampreporter-benchclerk-channel, benchclerk-judge-channel, benchclerk-lawyer-channel"
    log_info "Owner: BenchClerksOrg (will approve + commit)"
    log_info "Other orgs needing approval: StampReportersOrg, JudgesOrg, LawyersOrg"
    
    switch_to_benchclerkorg
    
    # stampreporter-benchclerk-channel
    log_section "Upgrading benchclerk on stampreporter-benchclerk-channel"
    approve_chaincode "stampreporter-benchclerk-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
    commit_chaincode "stampreporter-benchclerk-channel" "benchclerk"
    
    # benchclerk-judge-channel
    log_section "Upgrading benchclerk on benchclerk-judge-channel"
    approve_chaincode "benchclerk-judge-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
    commit_chaincode "benchclerk-judge-channel" "benchclerk"
    
    # benchclerk-lawyer-channel
    log_section "Upgrading benchclerk on benchclerk-lawyer-channel"
    approve_chaincode "benchclerk-lawyer-channel" "benchclerk" "$BENCHCLERK_CC_PACKAGE_ID"
    commit_chaincode "benchclerk-lawyer-channel" "benchclerk"
    
    log_success "BENCHCLERK chaincode upgraded on all channels!"
    
    # Get latest package file
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    
    # Prompt for automation
    if prompt_upgrade_automation "benchclerk" "stampreporter:stampreporter-benchclerk-channel" "judge:benchclerk-judge-channel" "lawyer:benchclerk-lawyer-channel"; then
        log_section "Starting Automated Upgrade Approval Process"
        
        # Automate for StampReportersOrg
        automate_org_upgrade "stampreporter" "benchclerk" "stampreporter-benchclerk-channel" "$benchclerk_pkg"
        
        # Automate for JudgesOrg
        automate_org_upgrade "judge" "benchclerk" "benchclerk-judge-channel" "$benchclerk_pkg"
        
        # Automate for LawyersOrg
        automate_org_upgrade "lawyer" "benchclerk" "benchclerk-lawyer-channel" "$benchclerk_pkg"
        
        log_success "Automated upgrade approval complete for all organizations!"
    else
        # Manual mode - show commands
        echo ""
        log_section "MANUAL MODE: Install and Approve on Other Orgs"
        echo ""
        log_info "Step 1: Switch to org and install the new 'benchclerk' chaincode package:"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch stampreporter"
        echo -e "  source ./deploy_chaincode.sh install stampreporter"
        echo ""
        echo -e "  ${CYAN}# JudgesOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch judge"
        echo -e "  source ./deploy_chaincode.sh install judge"
        echo ""
        echo -e "  ${CYAN}# LawyersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch lawyer"
        echo -e "  source ./deploy_chaincode.sh install lawyer"
        echo ""
        log_info "Step 2: After installation, approve the upgrade on each org:"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode stampreporter benchclerk stampreporter-benchclerk-channel"
        echo ""
        echo -e "  ${CYAN}# JudgesOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode judge benchclerk benchclerk-judge-channel"
        echo ""
        echo -e "  ${CYAN}# LawyersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode lawyer benchclerk benchclerk-lawyer-channel"
    fi
}

upgrade_judge_chaincode() {
    log_section "Upgrading JUDGE CHAINCODE on all channels"
    log_info "Channels: benchclerk-judge-channel"
    log_info "Owner: JudgesOrg (will approve + commit)"
    log_info "Other orgs needing approval: BenchClerksOrg"
    
    switch_to_judgeorg
    
    # benchclerk-judge-channel
    log_section "Upgrading judge on benchclerk-judge-channel"
    approve_chaincode "benchclerk-judge-channel" "judge" "$JUDGE_CC_PACKAGE_ID"
    commit_chaincode "benchclerk-judge-channel" "judge"
    
    log_success "JUDGE chaincode upgraded on all channels!"
    
    # Get latest package file
    local judge_pkg=$(get_latest_package "judge")
    
    # Prompt for automation
    if prompt_upgrade_automation "judge" "benchclerk:benchclerk-judge-channel"; then
        log_section "Starting Automated Upgrade Approval Process"
        
        # Automate for BenchClerksOrg
        automate_org_upgrade "benchclerk" "judge" "benchclerk-judge-channel" "$judge_pkg"
        
        log_success "Automated upgrade approval complete for all organizations!"
    else
        # Manual mode - show commands
        echo ""
        log_section "MANUAL MODE: Install and Approve on Other Orgs"
        echo ""
        log_info "Step 1: Switch to org and install the new 'judge' chaincode package:"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch benchclerk"
        echo -e "  source ./deploy_chaincode.sh install benchclerk"
        echo ""
        log_info "Step 2: After installation, approve the upgrade on each org:"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode benchclerk judge benchclerk-judge-channel"
    fi
}

# Generic upgrade function
upgrade_chaincode() {
    local chaincode_name=$1
    
    case $chaincode_name in
        lawyer)
            upgrade_lawyer_chaincode
            ;;
        registrar)
            upgrade_registrar_chaincode
            ;;
        stampreporter)
            upgrade_stampreporter_chaincode
            ;;
        benchclerk)
            upgrade_benchclerk_chaincode
            ;;
        judge)
            upgrade_judge_chaincode
            ;;
        *)
            log_error "Unknown chaincode: $chaincode_name"
            echo "Valid options: lawyer, registrar, stampreporter, benchclerk, judge"
            return 1
            ;;
    esac
}

# =============================================================================
# Sync Upgrade - Approve already upgraded chaincode on other orgs
# =============================================================================
# Use this when the owner org has already upgraded (using deploy or upgrade)
# and now other orgs need to install and approve the SAME version

sync_upgrade_lawyer() {
    log_section "Syncing LAWYER chaincode upgrade on other orgs"
    log_info "This will install and approve the current lawyer version on other orgs"
    
    # Get latest package file
    local lawyer_pkg=$(get_latest_package "lawyer")
    
    if [ -z "$lawyer_pkg" ]; then
        log_error "No lawyer package found. Please run 'package lawyer' first."
        return 1
    fi
    
    log_info "Using package: $lawyer_pkg"
    echo ""
    
    # Prompt for automation
    echo -e "${YELLOW}Do you want to automatically install and approve on other orgs?${NC}"
    echo "  1) Yes - Automatic"
    echo "  2) No - Show me manual commands"
    echo ""
    read -p "Enter your choice (1 or 2): " choice
    
    if [ "$choice" == "1" ]; then
        log_section "Starting Automated Sync Process"
        
        # Automate for RegistrarsOrg
        automate_org_upgrade "registrar" "lawyer" "lawyer-registrar-channel" "$lawyer_pkg"
        
        # Automate for StampReportersOrg
        automate_org_upgrade "stampreporter" "lawyer" "stampreporter-lawyer-channel" "$lawyer_pkg"
        
        # Automate for BenchClerksOrg
        automate_org_upgrade "benchclerk" "lawyer" "benchclerk-lawyer-channel" "$lawyer_pkg"
        
        log_success "Sync complete for all organizations!"
    else
        # Manual mode
        echo ""
        log_section "MANUAL MODE: Install and Approve on Other Orgs"
        echo ""
        log_info "Step 1: Switch to org and install the 'lawyer' chaincode package:"
        echo ""
        echo -e "  ${CYAN}# RegistrarsOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch registrar"
        echo -e "  source ./deploy_chaincode.sh install registrar"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch stampreporter"
        echo -e "  source ./deploy_chaincode.sh install stampreporter"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh switch benchclerk"
        echo -e "  source ./deploy_chaincode.sh install benchclerk"
        echo ""
        log_info "Step 2: After installation, approve on each org:"
        echo ""
        echo -e "  ${CYAN}# RegistrarsOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode registrar lawyer lawyer-registrar-channel"
        echo ""
        echo -e "  ${CYAN}# StampReportersOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode stampreporter lawyer stampreporter-lawyer-channel"
        echo ""
        echo -e "  ${CYAN}# BenchClerksOrg:${NC}"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode benchclerk lawyer benchclerk-lawyer-channel"
    fi
}

sync_upgrade_registrar() {
    log_section "Syncing REGISTRAR chaincode upgrade on other orgs"
    local registrar_pkg=$(get_latest_package "registrar")
    
    if [ -z "$registrar_pkg" ]; then
        log_error "No registrar package found. Please run 'package registrar' first."
        return 1
    fi
    
    log_info "Using package: $registrar_pkg"
    echo ""
    echo -e "${YELLOW}Do you want to automatically install and approve on other orgs?${NC}"
    echo "  1) Yes - Automatic"
    echo "  2) No - Show me manual commands"
    read -p "Enter your choice (1 or 2): " choice
    
    if [ "$choice" == "1" ]; then
        automate_org_upgrade "lawyer" "registrar" "lawyer-registrar-channel" "$registrar_pkg"
        automate_org_upgrade "stampreporter" "registrar" "registrar-stampreporter-channel" "$registrar_pkg"
        log_success "Sync complete!"
    else
        echo ""
        log_info "Manual commands:"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode lawyer registrar lawyer-registrar-channel"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode stampreporter registrar registrar-stampreporter-channel"
    fi
}

sync_upgrade_stampreporter() {
    log_section "Syncing STAMPREPORTER chaincode upgrade on other orgs"
    local stampreporter_pkg=$(get_latest_package "stampreporter")
    
    if [ -z "$stampreporter_pkg" ]; then
        log_error "No stampreporter package found."
        return 1
    fi
    
    log_info "Using package: $stampreporter_pkg"
    echo ""
    echo -e "${YELLOW}Do you want to automatically install and approve on other orgs?${NC}"
    echo "  1) Yes - Automatic"
    echo "  2) No - Show me manual commands"
    read -p "Enter your choice (1 or 2): " choice
    
    if [ "$choice" == "1" ]; then
        automate_org_upgrade "registrar" "stampreporter" "registrar-stampreporter-channel" "$stampreporter_pkg"
        automate_org_upgrade "lawyer" "stampreporter" "stampreporter-lawyer-channel" "$stampreporter_pkg"
        automate_org_upgrade "benchclerk" "stampreporter" "stampreporter-benchclerk-channel" "$stampreporter_pkg"
        log_success "Sync complete!"
    else
        echo ""
        log_info "Manual commands:"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode registrar stampreporter registrar-stampreporter-channel"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode lawyer stampreporter stampreporter-lawyer-channel"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode benchclerk stampreporter stampreporter-benchclerk-channel"
    fi
}

sync_upgrade_benchclerk() {
    log_section "Syncing BENCHCLERK chaincode upgrade on other orgs"
    local benchclerk_pkg=$(get_latest_package "benchclerk")
    
    if [ -z "$benchclerk_pkg" ]; then
        log_error "No benchclerk package found."
        return 1
    fi
    
    log_info "Using package: $benchclerk_pkg"
    echo ""
    echo -e "${YELLOW}Do you want to automatically install and approve on other orgs?${NC}"
    echo "  1) Yes - Automatic"
    echo "  2) No - Show me manual commands"
    read -p "Enter your choice (1 or 2): " choice
    
    if [ "$choice" == "1" ]; then
        automate_org_upgrade "stampreporter" "benchclerk" "stampreporter-benchclerk-channel" "$benchclerk_pkg"
        automate_org_upgrade "judge" "benchclerk" "benchclerk-judge-channel" "$benchclerk_pkg"
        automate_org_upgrade "lawyer" "benchclerk" "benchclerk-lawyer-channel" "$benchclerk_pkg"
        log_success "Sync complete!"
    else
        echo ""
        log_info "Manual commands:"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode stampreporter benchclerk stampreporter-benchclerk-channel"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode judge benchclerk benchclerk-judge-channel"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode lawyer benchclerk benchclerk-lawyer-channel"
    fi
}

sync_upgrade_judge() {
    log_section "Syncing JUDGE chaincode upgrade on other orgs"
    local judge_pkg=$(get_latest_package "judge")
    
    if [ -z "$judge_pkg" ]; then
        log_error "No judge package found."
        return 1
    fi
    
    log_info "Using package: $judge_pkg"
    echo ""
    echo -e "${YELLOW}Do you want to automatically install and approve on other orgs?${NC}"
    echo "  1) Yes - Automatic"
    echo "  2) No - Show me manual commands"
    read -p "Enter your choice (1 or 2): " choice
    
    if [ "$choice" == "1" ]; then
        automate_org_upgrade "benchclerk" "judge" "benchclerk-judge-channel" "$judge_pkg"
        log_success "Sync complete!"
    else
        echo ""
        log_info "Manual commands:"
        echo -e "  source ./deploy_chaincode.sh approve-chaincode benchclerk judge benchclerk-judge-channel"
    fi
}

# Generic sync-upgrade function
sync_upgrade_chaincode() {
    local chaincode_name=$1
    
    case $chaincode_name in
        lawyer)
            sync_upgrade_lawyer
            ;;
        registrar)
            sync_upgrade_registrar
            ;;
        stampreporter)
            sync_upgrade_stampreporter
            ;;
        benchclerk)
            sync_upgrade_benchclerk
            ;;
        judge)
            sync_upgrade_judge
            ;;
        *)
            log_error "Unknown chaincode: $chaincode_name"
            return 1
            ;;
    esac
}

# =============================================================================
# Approve Single Chaincode on Specific Channel (for non-owner orgs)
# =============================================================================
# Use this when another org has upgraded a chaincode and you need to approve
# the new version on your shared channel(s).

approve_single_chaincode() {
    local org=$1
    local chaincode_name=$2
    local channel=$3
    local package_id_var="${chaincode_name^^}_CC_PACKAGE_ID"
    local package_id="${!package_id_var}"
    
    if [ -z "$org" ] || [ -z "$chaincode_name" ] || [ -z "$channel" ]; then
        log_error "Usage: approve-chaincode <org> <chaincode> <channel>"
        echo "Example: source ./deploy_chaincode.sh approve-chaincode registrar lawyer lawyer-registrar-channel"
        return 1
    fi
    
    if [ -z "$package_id" ]; then
        log_error "Package ID not set for ${chaincode_name}. Export ${package_id_var} first."
        return 1
    fi
    
    log_section "Approving ${chaincode_name} chaincode on ${channel}"
    
    # Switch to the specified org
    switch_org "$org"
    
    # Use smart approve to match committed version
    approve_chaincode_smart "$channel" "$chaincode_name" "$package_id"
    
    log_success "Approved ${chaincode_name} on ${channel} for ${org}Org"
}

# Show what approvals are pending for an org after another org upgraded
show_pending_approvals() {
    local org=$1
    
    log_section "Checking pending approvals for ${org}Org"
    
    switch_org "$org"
    
    # Define which chaincodes each org needs and on which channels
    case $org in
        lawyer)
            echo "LawyersOrg channels and chaincodes:"
            echo "  lawyer-registrar-channel: lawyer (owner), registrar"
            echo "  stampreporter-lawyer-channel: lawyer (owner), stampreporter"
            echo "  benchclerk-lawyer-channel: lawyer (owner), benchclerk"
            echo ""
            log_info "Checking commit readiness..."
            check_readiness "lawyer-registrar-channel" "registrar" 2>/dev/null || true
            check_readiness "stampreporter-lawyer-channel" "stampreporter" 2>/dev/null || true
            check_readiness "benchclerk-lawyer-channel" "benchclerk" 2>/dev/null || true
            ;;
        registrar)
            echo "RegistrarsOrg channels and chaincodes:"
            echo "  lawyer-registrar-channel: registrar (owner), lawyer"
            echo "  registrar-stampreporter-channel: registrar (owner), stampreporter"
            echo ""
            log_info "Checking commit readiness..."
            check_readiness "lawyer-registrar-channel" "lawyer" 2>/dev/null || true
            check_readiness "registrar-stampreporter-channel" "stampreporter" 2>/dev/null || true
            ;;
        stampreporter)
            echo "StampReportersOrg channels and chaincodes:"
            echo "  registrar-stampreporter-channel: stampreporter (owner), registrar"
            echo "  stampreporter-lawyer-channel: stampreporter (owner), lawyer"
            echo "  stampreporter-benchclerk-channel: stampreporter (owner), benchclerk"
            echo ""
            log_info "Checking commit readiness..."
            check_readiness "registrar-stampreporter-channel" "registrar" 2>/dev/null || true
            check_readiness "stampreporter-lawyer-channel" "lawyer" 2>/dev/null || true
            check_readiness "stampreporter-benchclerk-channel" "benchclerk" 2>/dev/null || true
            ;;
        benchclerk)
            echo "BenchClerksOrg channels and chaincodes:"
            echo "  stampreporter-benchclerk-channel: benchclerk (owner), stampreporter"
            echo "  benchclerk-judge-channel: benchclerk (owner), judge"
            echo "  benchclerk-lawyer-channel: benchclerk (owner), lawyer"
            echo ""
            log_info "Checking commit readiness..."
            check_readiness "stampreporter-benchclerk-channel" "stampreporter" 2>/dev/null || true
            check_readiness "benchclerk-judge-channel" "judge" 2>/dev/null || true
            check_readiness "benchclerk-lawyer-channel" "lawyer" 2>/dev/null || true
            ;;
        judge)
            echo "JudgesOrg channels and chaincodes:"
            echo "  benchclerk-judge-channel: judge (owner), benchclerk"
            echo ""
            log_info "Checking commit readiness..."
            check_readiness "benchclerk-judge-channel" "benchclerk" 2>/dev/null || true
            ;;
        *)
            log_error "Unknown organization: $org"
            return 1
            ;;
    esac
}

# =============================================================================
# Usage Information
# =============================================================================

show_usage() {
    echo ""
    echo -e "${GREEN}eVAULT Chaincode Deployment Script${NC}"
    echo ""
    echo "Usage: source ./deploy_chaincode.sh <command> [options]"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}GLOBAL AUTOMATED COMMANDS (Recommended for ease of use):${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo "  global-install            - Install all chaincodes on ALL orgs (auto-switch, prompts)"
    echo "  global-deploy             - Initial deploy on ALL orgs (FIRST TIME ONLY)"
    echo "  global-upgrade <chaincode> - Upgrade chaincode across ALL required orgs (auto-switch)"
    echo ""
    echo -e "${CYAN}Basic Commands:${NC}"
    echo "  switch <org>              - Switch to organization context"
    echo "  package                   - Package all chaincodes with auto-versioning"
    echo "  package <name>            - Package specific chaincode"
    echo "  install <org>             - Install chaincodes on specific org (interactive)"
    echo "  install-all               - Install chaincodes on all orgs (interactive)"
    echo "  query                     - Query all committed chaincodes"
    echo "  query-installed           - Query installed chaincodes on current peer"
    echo ""
    echo -e "${CYAN}Initial Deployment Commands:${NC}"
    echo "  deploy <org>              - Deploy (approve/commit) for specific org"
    echo "  deploy <org> <channel>    - Deploy only on specific channel"
    echo "  deploy all                - Deploy for all orgs (interactive)"
    echo ""
    echo -e "${CYAN}Upgrade Commands (for updating a specific chaincode):${NC}"
    echo "  upgrade <chaincode>       - Upgrade chaincode on all its channels (owner org)"
    echo "                              This approves + commits the new version"
    echo "                              NOTE: Only use after creating a NEW package version"
    echo ""
    echo "  sync-upgrade <chaincode>  - Sync already upgraded chaincode to other orgs"
    echo "                              Use when owner org already upgraded but other orgs need to catch up"
    echo ""
    echo -e "${CYAN}Approval Commands (for non-owner orgs after upgrade):${NC}"
    echo "  approve-chaincode <org> <chaincode> <channel>"
    echo "                            - Approve a specific chaincode on a channel"
    echo "  pending <org>             - Show pending approvals for an org"
    echo ""
    echo -e "${CYAN}Organizations:${NC} lawyerorg, registrarorg, stampreporterorg, benchclerkorg, judgeorg"
    echo -e "${CYAN}Chaincodes:${NC} lawyer, registrar, stampreporter, benchclerk, judge"
    echo ""
    echo -e "${CYAN}Chaincode Ownership (who approves+commits first):${NC}"
    echo "  lawyer:       LawyersOrg       (channels: lawyer-registrar, stampreporter-lawyer, benchclerk-lawyer)"
    echo "  registrar:    RegistrarsOrg    (channels: lawyer-registrar, registrar-stampreporter)"
    echo "  stampreporter: StampReportersOrg (channels: registrar-stampreporter, stampreporter-lawyer, stampreporter-benchclerk)"
    echo "  benchclerk:   BenchClerksOrg   (channels: stampreporter-benchclerk, benchclerk-judge, benchclerk-lawyer)"
    echo "  judge:        JudgesOrg        (channels: benchclerk-judge)"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}QUICK START (First Time Setup):${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo "  1. Package all chaincodes:  source ./deploy_chaincode.sh package"
    echo "  2. Install on all orgs:     source ./deploy_chaincode.sh global-install"
    echo "  3. Deploy on all orgs:      source ./deploy_chaincode.sh global-deploy"
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}UPGRADE WORKFLOW (Update existing chaincode):${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo "  1. Package new version:     source ./deploy_chaincode.sh package lawyer"
    echo "  2. Upgrade globally:        source ./deploy_chaincode.sh global-upgrade lawyer"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo "  source ./deploy_chaincode.sh switch lawyerorg"
    echo "  source ./deploy_chaincode.sh package"
    echo "  source ./deploy_chaincode.sh global-install"
    echo "  source ./deploy_chaincode.sh global-deploy"
    echo "  source ./deploy_chaincode.sh global-upgrade lawyer"
    echo ""
}

# =============================================================================
# Main Entry Point
# =============================================================================

main() {
    local command=$1
    local arg1=$2
    local arg2=$3
    local arg3=$4
    
    if [ -z "$command" ]; then
        show_usage
        return 0
    fi
    
    case $command in
        switch)
            switch_org "$arg1"
            ;;
        package)
            if [ -z "$arg1" ]; then
                package_all_chaincodes
            else
                package_chaincode "$arg1"
            fi
            ;;
        install)
            case $arg1 in
                lawyerorg)
                    install_on_lawyer
                    ;;
                registrarorg)
                    install_on_registrar
                    ;;
                stampreporterorg)
                    install_on_stampreporter
                    ;;
                benchclerkorg)
                    install_on_benchclerk
                    ;;
                judgeorg)
                    install_on_judge
                    ;;
                *)
                    log_error "Unknown organization: $arg1"
                    echo "Valid options: lawyerorg, registrarorg, stampreporterorg, benchclerkorg, judgeorg"
                    return 1
                    ;;
            esac
            ;;
        install-all)
            install_all_orgs
            ;;
        deploy)
            set_package_ids
            case $arg1 in
                lawyerorg)
                    deploy_lawyer_org "$arg2"
                    ;;
                registrarorg)
                    deploy_registrar_org "$arg2"
                    ;;
                stampreporterorg)
                    deploy_stampreporter_org "$arg2"
                    ;;
                benchclerkorg)
                    deploy_benchclerk_org "$arg2"
                    ;;
                judgeorg)
                    deploy_judge_org "$arg2"
                    ;;
                all)
                    deploy_all_orgs
                    ;;
                *)
                    log_error "Unknown organization: $arg1"
                    echo "Valid options: lawyerorg, registrarorg, stampreporterorg, benchclerkorg, judgeorg, all"
                    return 1
                    ;;
            esac
            ;;
        global-install)
            global_install
            ;;
        global-deploy)
            global_deploy
            ;;
        global-upgrade)
            global_upgrade "$arg1"
            ;;
        upgrade)
            set_package_ids
            upgrade_chaincode "$arg1"
            ;;
        sync-upgrade)
            set_package_ids
            sync_upgrade_chaincode "$arg1"
            ;;
        approve-chaincode)
            set_package_ids
            approve_single_chaincode "$arg1" "$arg2" "$arg3"
            ;;
        pending)
            show_pending_approvals "$arg1"
            ;;
        query)
            query_all_committed
            ;;
        query-installed)
            query_installed
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            log_error "Unknown command: $command"
            show_usage
            return 1
            ;;
    esac
}

# Only run main if arguments provided (for sourcing support)
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    # Script is being executed directly
    main "$@"
else
    # Script is being sourced - run main if arguments provided
    if [ $# -gt 0 ]; then
        main "$@"
    fi
fi
