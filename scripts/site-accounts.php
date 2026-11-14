<?php
/**
 * Creates the accounts the suite signs in with, once, on the test site:
 * a restricted admin role and its user, and the customers with one address.
 * Run by scripts/build-site.sh inside the web container:
 *
 *   php scripts/site-accounts.php
 *
 * It is safe to run again: an account that exists is left as it is.
 * The values come from the environment (see build-site.sh for the defaults).
 */

use Magento\Framework\App\Bootstrap;

require getcwd() . '/app/bootstrap.php';

$bootstrap = Bootstrap::create(BP, $_SERVER);
$om = $bootstrap->getObjectManager();
$om->get(\Magento\Framework\App\State::class)->setAreaCode('adminhtml');

$env = static function (string $name, string $default): string {
    $value = getenv($name);
    return ($value === false || $value === '') ? $default : $value;
};

// --- A restricted admin role: Sales only (orders, invoices, shipments, credit memos). ---
$roleName = $env('SALES_ROLE', 'Sales');
/** @var \Magento\Authorization\Model\ResourceModel\Role\Collection $roles */
$roles = $om->create(\Magento\Authorization\Model\ResourceModel\Role\CollectionFactory::class)->create();
$role = $roles->addFieldToFilter('role_name', $roleName)->addFieldToFilter('role_type', 'G')->getFirstItem();
if (!$role->getId()) {
    $role = $om->create(\Magento\Authorization\Model\RoleFactory::class)->create();
    $role->setRoleName($roleName)->setParentId(0)->setRoleType('G')->setUserType(2)->save();
    $om->create(\Magento\Authorization\Model\RulesFactory::class)->create()
        ->setRoleId($role->getId())
        ->setResources([
            'Magento_Backend::admin',
            'Magento_Sales::sales',
            'Magento_Sales::sales_operation',
            'Magento_Sales::sales_order',
            'Magento_Sales::actions',
            'Magento_Sales::create',
            'Magento_Sales::actions_view',
            'Magento_Sales::email',
            'Magento_Sales::reorder',
            'Magento_Sales::actions_edit',
            'Magento_Sales::cancel',
            'Magento_Sales::review_payment',
            'Magento_Sales::capture',
            'Magento_Sales::invoice',
            'Magento_Sales::creditmemo',
            'Magento_Sales::hold',
            'Magento_Sales::unhold',
            'Magento_Sales::ship',
            'Magento_Sales::comment',
            'Magento_Sales::emails',
            'Magento_Sales::sales_invoice',
            'Magento_Sales::shipment',
            'Magento_Sales::sales_creditmemo',
        ])
        ->saveRel();
    echo "Created the admin role \"$roleName\".\n";
}

$salesUser = $env('SALES_USER', 'sales');
$user = $om->create(\Magento\User\Model\UserFactory::class)->create()->loadByUsername($salesUser);
if (!$user->getId()) {
    $user->setData([
        'username' => $salesUser,
        'firstname' => 'Sally',
        'lastname' => 'Sales',
        'email' => $env('SALES_EMAIL', 'sales@example.com'),
        'password' => $env('SALES_PASSWORD', 'Sales123456789!'),
        'interface_locale' => 'en_US',
        'is_active' => 1,
    ]);
    $user->setRoleId($role->getId())->save();
    echo "Created the admin user \"$salesUser\" with the role \"$roleName\".\n";
}

// --- Customers, each with a default billing and shipping address. ---
$storeManager = $om->get(\Magento\Store\Model\StoreManagerInterface::class);
$websiteId = (int) $storeManager->getDefaultStoreView()->getWebsiteId();
$storeId = (int) $storeManager->getDefaultStoreView()->getId();
$customerRepository = $om->get(\Magento\Customer\Api\CustomerRepositoryInterface::class);
$accountManagement = $om->get(\Magento\Customer\Api\AccountManagementInterface::class);
$customerFactory = $om->get(\Magento\Customer\Api\Data\CustomerInterfaceFactory::class);
$addressFactory = $om->get(\Magento\Customer\Api\Data\AddressInterfaceFactory::class);
$regionFactory = $om->get(\Magento\Customer\Api\Data\RegionInterfaceFactory::class);
$directoryRegion = $om->get(\Magento\Directory\Model\RegionFactory::class);

$customers = [
    ['CUSTOMER', 'customer@example.com', 'Customer123456789!', 'Casey', 'Customer', '100 Main Street', 'Austin', 'TX', '78701', '5125550100'],
    ['SHOPPER', 'shopper@example.com', 'Shopper123456789!', 'Sam', 'Shopper', '200 Market Street', 'San Francisco', 'CA', '94105', '4155550100'],
];
foreach ($customers as [$prefix, $email, $password, $first, $last, $street, $city, $regionCode, $postcode, $phone]) {
    $email = $env($prefix . '_EMAIL', $email);
    $password = $env($prefix . '_PASSWORD', $password);
    try {
        $customerRepository->get($email, $websiteId);
        continue;
    } catch (\Magento\Framework\Exception\NoSuchEntityException $e) {
        // Not there yet: create it below.
    }
    $region = $directoryRegion->create()->loadByCode($regionCode, 'US');
    $address = $addressFactory->create()
        ->setFirstname($first)->setLastname($last)
        ->setStreet([$street])->setCity($city)->setPostcode($postcode)
        ->setCountryId('US')->setTelephone($phone)
        ->setRegionId((int) $region->getId())
        ->setRegion($regionFactory->create()->setRegionId((int) $region->getId())->setRegion($region->getName())->setRegionCode($regionCode))
        ->setIsDefaultBilling(true)->setIsDefaultShipping(true);
    $customer = $customerFactory->create()
        ->setEmail($email)->setFirstname($first)->setLastname($last)
        ->setWebsiteId($websiteId)->setStoreId($storeId)->setGroupId(1)
        ->setAddresses([$address]);
    $accountManagement->createAccount($customer, $password);
    echo "Created the customer $email.\n";
}
