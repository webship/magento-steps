#!/usr/bin/env bash
# Builds the test site the suite runs against: Magento Open Source (the
# community edition) with its sample data, in one DDEV project, without any
# question asked, then creates the accounts named in cucumber.js.
#
# The packages come from the public Mage-OS mirror of the Magento Open Source
# packages (https://mirror.mage-os.org/): it serves the same releases as the
# vendor's repository without access keys, so the build needs no account.
#
# Settings (environment variables, all optional):
#   MAGENTO_VERSION   the release to install             (default 2.4.9)
#   PHP_VERSION       the PHP version of the container   (default 8.4)
#   DB_VERSION        the database of the container      (default mariadb:11.4)
#   OPENSEARCH_TAG    the search engine image tag        (default 3)
#   PROJECT_NAME      the DDEV project name              (default magentosteps)
#   SITE_DIR          the project folder                 (default ../magento-site next to this repository)
#   SAMPLE_DATA       1 installs the sample data, 0 leaves the catalog empty (default 1; the suite needs it)
#   DEPLOY_MODE       production or developer            (default production)
#   BACKEND_FRONTNAME the admin path                     (default admin)
#   ADMIN_USER, ADMIN_PASSWORD        the administrator                    (admin / Admin123456789!)
#   SALES_USER, SALES_PASSWORD        an admin with the "Sales" role only  (sales / Sales123456789!)
#   CUSTOMER_EMAIL, CUSTOMER_PASSWORD a customer with an address           (customer@example.com / Customer123456789!)
#   SHOPPER_EMAIL, SHOPPER_PASSWORD   a second customer with an address    (shopper@example.com / Shopper123456789!)
#
# The accounts are configuration: created once here, named in cucumber.js; a
# feature never creates or deletes one of them.
#
# What this build turns off, because a test site must not ask a person for a
# code or call anything outside:
#   - two-factor authentication for admins (the modules Magento_TwoFactorAuth
#     and Magento_AdminAdobeImsTwoFactorAuth are not installed). Never do this on a
#     site that is on the internet.
#   - the admin notification feed, the usage-data question, the release
#     notification, the CAPTCHAs, the secret key in admin addresses.
#   - the bundled payment gateway and data-export extensions, which make the
#     storefront load scripts from outside servers even when not configured.
set -euo pipefail

MAGENTO_VERSION="${MAGENTO_VERSION:-2.4.9}"
PHP_VERSION="${PHP_VERSION:-8.4}"
DB_VERSION="${DB_VERSION:-mariadb:11.4}"
OPENSEARCH_TAG="${OPENSEARCH_TAG:-3}"
PROJECT_NAME="${PROJECT_NAME:-magentosteps}"
SAMPLE_DATA="${SAMPLE_DATA:-1}"
DEPLOY_MODE="${DEPLOY_MODE:-production}"
BACKEND_FRONTNAME="${BACKEND_FRONTNAME:-admin}"
ADMIN_USER="${ADMIN_USER:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123456789!}"
MIRROR_URL="${MIRROR_URL:-https://mirror.mage-os.org/}"

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SITE_DIR="${SITE_DIR:-$(dirname "$REPO_DIR")/magento-site}"
mkdir -p "$SITE_DIR"
cd "$SITE_DIR"

step() { printf '\n=== %s (%s) ===\n' "$1" "$(date +%H:%M:%S)"; }

step "DDEV project"
ddev config </dev/null --project-name="$PROJECT_NAME" --project-type=magento2 --docroot=pub \
  --upload-dirs=media --disable-settings-management \
  --php-version="$PHP_VERSION" --database="$DB_VERSION"

# The search engine Magento requires, from the official DDEV add-on.
if [ ! -f .ddev/docker-compose.opensearch.yaml ]; then
  if ! ddev add-on get ddev/ddev-opensearch; then
    # An older DDEV than the add-on asks for: install the same add-on from a
    # clone with the version constraint relaxed.
    ADDON_DIR="$(mktemp -d)"
    git clone -q --depth 1 https://github.com/ddev/ddev-opensearch.git "$ADDON_DIR"
    sed -i '/^ddev_version_constraint:/d' "$ADDON_DIR/install.yaml"
    ddev add-on get "$ADDON_DIR"
    rm -rf "$ADDON_DIR"
  fi
fi
printf 'OPENSEARCH_TAG=%s\n' "$OPENSEARCH_TAG" > .ddev/.env.opensearch
# A test site needs the engine, not its dashboards (another 1.5 GB image and a
# second Node process): the service is taken out of the add-on's compose file.
# The heap stays at the add-on's 512 MB.
python3 - <<'PY'
import re
path = '.ddev/docker-compose.opensearch.yaml'
text = open(path).read()
text = text.replace('#ddev-generated\n', '# From the ddev/ddev-opensearch add-on, without its dashboards service.\n', 1)
text = re.sub(r'\n  opensearch-dashboards:.*?(?=\n  web:)', '\n', text, flags=re.S)
open(path, 'w').write(text)
PY
ddev start </dev/null

SITE_URL="$(ddev describe -j | python3 -c "import json,sys; print(json.load(sys.stdin)['raw']['primary_url'])")"

step "Packages from $MIRROR_URL"
if [ ! -f composer.json ]; then
  ddev composer create-project </dev/null --repository-url="$MIRROR_URL" \
    "magento/project-community-edition:$MAGENTO_VERSION" . --no-interaction --prefer-dist
fi

# Modules a test store never installs. They are left out at install time (not
# disabled afterwards): a module disabled after the install leaves its database
# triggers behind, and the next order fails on a column that is gone.
#   - two-factor authentication, and what asks the admin user questions or
#     fetches a feed;
#   - the payment gateway and data-export extensions bundled with the edition.
#     They are not configured, yet with them every storefront page loads two
#     scripts from the gateway's servers (for a message in the mini cart) and the
#     checkout loads an asset of the payment provider. A test store calls nothing
#     outside: the suite uses the offline methods (check / money order, flat
#     rate, free shipping).
DISABLED_MODULES="Magento_AdminAdobeImsTwoFactorAuth,Magento_TwoFactorAuth,\
Magento_AdminNotification,Magento_AdminAnalytics,Magento_ReleaseNotification,\
PayPal_Braintree,PayPal_BraintreeCustomerBalance,PayPal_BraintreeGiftCard,PayPal_BraintreeGiftCardAccount,\
PayPal_BraintreeGiftWrapping,PayPal_BraintreeGraphQl,PayPal_BraintreeReward,\
Magento_PaymentServicesBase,Magento_PaymentServicesDashboard,Magento_PaymentServicesPaypal,\
Magento_PaymentServicesPaypalGraphQl,Magento_PaymentServicesSaaSExport,Magento_ServiceProxy,\
Magento_ServicesConnector,Magento_ServicesId,Magento_ServicesIdGraphQlServer,Magento_ServicesIdLayout,\
Magento_SaaSCommon,Magento_DataExporter,Magento_SalesDataExporter,Magento_StoreDataExporter"

step "Install"
# A rebuild starts from nothing: the old configuration and the generated files go.
rm -rf app/etc/env.php app/etc/config.php generated/code generated/metadata var/cache var/page_cache var/view_preprocessed pub/static/frontend pub/static/adminhtml pub/static/deployed_version.txt
ddev exec </dev/null "php bin/magento setup:install \
  --disable-modules='$DISABLED_MODULES' \
  --base-url='$SITE_URL/' --base-url-secure='$SITE_URL/' --use-secure=1 --use-secure-admin=1 --use-rewrites=1 \
  --db-host=db --db-name=db --db-user=db --db-password=db \
  --search-engine=opensearch --opensearch-host=opensearch --opensearch-port=9200 \
  --opensearch-index-prefix=magento2 --opensearch-enable-auth=0 --opensearch-timeout=15 \
  --backend-frontname='$BACKEND_FRONTNAME' \
  --admin-user='$ADMIN_USER' --admin-password='$ADMIN_PASSWORD' \
  --admin-email=admin@example.com --admin-firstname=Site --admin-lastname=Admin \
  --language=en_US --currency=USD --timezone=UTC \
  --session-save=files --cleanup-database --no-interaction"

if [ "$SAMPLE_DATA" = "1" ]; then
  step "Sample data"
  ddev exec </dev/null "php bin/magento sampledata:deploy --no-interaction"
fi

ddev exec </dev/null "php bin/magento setup:upgrade --no-interaction"

step "Configuration"
set_conf() { ddev exec </dev/null "php bin/magento config:set '$1' '$2'"; }
set_conf admin/security/session_lifetime 31536000
set_conf admin/security/use_form_key 0
set_conf admin/security/admin_account_sharing 1
set_conf admin/security/password_is_forced 0
set_conf admin/security/password_lifetime 0
set_conf admin/security/lockout_failures 0
set_conf admin/captcha/enable 0
set_conf customer/captcha/enable 0
set_conf customer/password/lockout_failures 0
set_conf analytics/subscription/enabled 0
set_conf web/cookie/cookie_lifetime 86400
set_conf checkout/options/guest_checkout 1
set_conf carriers/flatrate/active 1
set_conf carriers/freeshipping/active 1
set_conf carriers/freeshipping/free_shipping_subtotal 0
set_conf payment/checkmo/active 1
set_conf catalog/review/allow_guest 1
set_conf web/cookie/cookie_restriction 0

step "Accounts"
ddev exec </dev/null "mkdir -p var/site-build"
cp "$REPO_DIR/scripts/site-accounts.php" var/site-build/site-accounts.php
ddev exec </dev/null "SALES_USER='${SALES_USER:-sales}' SALES_PASSWORD='${SALES_PASSWORD:-Sales123456789!}' \
  CUSTOMER_EMAIL='${CUSTOMER_EMAIL:-customer@example.com}' CUSTOMER_PASSWORD='${CUSTOMER_PASSWORD:-Customer123456789!}' \
  SHOPPER_EMAIL='${SHOPPER_EMAIL:-shopper@example.com}' SHOPPER_PASSWORD='${SHOPPER_PASSWORD:-Shopper123456789!}' \
  php var/site-build/site-accounts.php"

step "Deploy mode: $DEPLOY_MODE"
if [ "$DEPLOY_MODE" = "production" ]; then
  ddev exec </dev/null "php bin/magento deploy:mode:set production --skip-compilation"
  ddev exec </dev/null "php -d memory_limit=2G bin/magento setup:di:compile"
  ddev exec </dev/null "php -d memory_limit=2G bin/magento setup:static-content:deploy -f --jobs=2 en_US"
else
  ddev exec </dev/null "php bin/magento deploy:mode:set developer"
fi

step "Indexes, cron once, caches"
# Indexes update when something is saved, not by a schedule: no cron runs on a
# test site, and a product a scenario creates must reach the storefront at once.
ddev exec </dev/null "php bin/magento indexer:set-mode realtime"
ddev exec </dev/null "php bin/magento indexer:reindex"
ddev exec </dev/null "php bin/magento cron:run" || true
ddev exec </dev/null "php bin/magento cache:flush"

# Warm the two entry points so the first scenario does not pay for it.
curl -ksS -o /dev/null -w 'Storefront: HTTP %{http_code}\n' "$SITE_URL/"
curl -ksSL -o /dev/null -w 'Admin sign-in: HTTP %{http_code}\n' "$SITE_URL/$BACKEND_FRONTNAME/"

echo "LAUNCH_URL=$SITE_URL"
if [ -n "${GITHUB_ENV:-}" ]; then echo "LAUNCH_URL=$SITE_URL" >> "$GITHUB_ENV"; fi
