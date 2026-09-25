"""
Clean database script:
- Removes all dummy contacts, contact attempts, feedback, registrations, followups, and audit logs.
- Resets users:
    1. admin@fms.internal (Password: admin123 and AdminPassword123!)
    2. admin@fms.com (Password: admin123)
    3. member@fms.internal (Password: member123)
"""
import sys
from pathlib import Path

# Add backend to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models import (
    User, UserRole, Contact, ContactAttempt,
    Feedback, Registration, FollowUp, AuditLog
)

def clean_database():
    db = SessionLocal()
    try:
        print("Clearing dummy data...")
        # Delete dependent tables first
        db.query(AuditLog).delete()
        db.query(FollowUp).delete()
        db.query(Registration).delete()
        db.query(Feedback).delete()
        db.query(ContactAttempt).delete()
        db.query(Contact).delete()
        db.commit()
        print("Cleared: Contact, ContactAttempt, Feedback, Registration, FollowUp, AuditLog.")

        # Ensure Admin users exist and passwords are easy and reliable
        # We ensure:
        # admin@fms.internal -> admin123
        # admin@fms.com -> admin123
        # member@fms.internal -> member123
        
        users_to_ensure = [
            {
                "name": "System Administrator",
                "email": "admin@fms.internal",
                "password": "admin123",
                "role": UserRole.admin,
            },
            {
                "name": "System Administrator (Alt)",
                "email": "admin@fms.com",
                "password": "admin123",
                "role": UserRole.admin,
            },
            {
                "name": "Sarah Outreach",
                "email": "member@fms.internal",
                "password": "member123",
                "role": UserRole.member,
            }
        ]

        for u_data in users_to_ensure:
            existing = db.query(User).filter(User.email == u_data["email"]).first()
            if existing:
                existing.name = u_data["name"]
                existing.password_hash = get_password_hash(u_data["password"])
                existing.role = u_data["role"]
                existing.is_active = True
                print(f"Updated user: {u_data['email']} with password: {u_data['password']}")
            else:
                new_user = User(
                    name=u_data["name"],
                    email=u_data["email"],
                    password_hash=get_password_hash(u_data["password"]),
                    role=u_data["role"],
                    is_active=True,
                )
                db.add(new_user)
                print(f"Created user: {u_data['email']} with password: {u_data['password']}")

        db.commit()
        print("\nDatabase is now clean and empty of dummy data!")
        print("Remaining records:")
        print(f"Contacts: {db.query(Contact).count()}")
        print(f"Users: {[(u.id, u.name, u.email, u.role.value) for u in db.query(User).all()]}")

    finally:
        db.close()

if __name__ == "__main__":
    clean_database()
