from app.models.user import User, Role, Permission, UserPreference  # noqa: F401
from app.models.school import (  # noqa: F401
    SchoolProfile, AcademicSession, AcademicTerm, Department, SchoolClass, ClassArm, Subject,
)
from app.models.people import (  # noqa: F401
    Student, Parent, Teacher, SecurityOfficer, Staff, StudentDocument, EmergencyContact, BulkImportLog,
)
from app.models.security import (  # noqa: F401
    AttendanceRecord, StudentCheckin, StudentCheckout, PickupAuthorization, PickupLog,
    VisitorLog, SecurityIncident, IncidentAttachment, StudentMovement, EmergencyAlert, NotificationEvent,
)
from app.models.academics import (  # noqa: F401
    AssessmentConfiguration, AssessmentComponent, ContinuousAssessment, ExamResult, SubjectResult,
    GradingSystem, GradeRange, ReportCard, BehaviourRecord, DisciplinaryAction,
)
from app.models.communication import (  # noqa: F401
    Conversation, Message, MessageAttachment, Announcement, Notification,
    Assignment, AssignmentAttachment, AssignmentSubmission, AssignmentFeedback,
    Meeting, PTAMeeting, PTAMinutes, SharedDocument,
)
from app.models.analytics import (  # noqa: F401
    AuditLog, ActivityLog, SavedReport, ReportExport, DashboardWidget, DashboardLayout,
)
from app.models.settings import (  # noqa: F401
    FeatureFlag, BrandingSettings, PasswordPolicy, SecuritySettings, NotificationSettings,
    StorageSettings, SMTPSettings, MaintenanceMode, BackupHistory, SystemLog,
)
