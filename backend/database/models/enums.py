import enum


class Carrier(str, enum.Enum):
    VIETTEL = "viettel"
    VINA    = "vina"
    MOBI    = "mobi"
    UNKNOWN = "unknown"


class SubscriptionType(str, enum.Enum):
    PREPAID  = "prepaid"
    POSTPAID = "postpaid"


class AccountStatus(str, enum.Enum):
    ACTIVE    = "active"
    INACTIVE  = "inactive"
    SUSPENDED = "suspended"


class CommType(str, enum.Enum):
    VOICE = "VOICE"
    SMS   = "SMS"


class Direction(str, enum.Enum):
    OUTGOING = "outgoing"
    INCOMING = "incoming"
    SERVICE  = "service"   # non-person sender: MBBANK, MyViettel, etc.


class ServiceCategory(str, enum.Enum):
    ONNET         = "onnet"          # Noi mang
    OFFNET        = "offnet"         # Ngoai mang
    VAS           = "vas"            # Value-added service
    INTERNATIONAL = "international"  # Quoc te (includes app-originated SMS)


class ImportStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED  = "failed"
