"""
Database seed script to create initial admin and member users, and realistic mock data.
Run with: python -m app.seed
"""
from datetime import datetime, timezone, timedelta
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models import (
    User, UserRole, Contact, ContactStatus, ContactAttempt,
    Feedback, Registration, RegistrationStatus, FollowUp, FollowUpStatus
)

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Admin User
        admin = db.query(User).filter(User.email == "admin@fms.internal").first()
        if not admin:
            admin = User(
                name="System Administrator",
                email="admin@fms.internal",
                password_hash=get_password_hash("AdminPassword123!"),
                role=UserRole.admin,
                is_active=True,
            )
            db.add(admin)
            db.flush()
            print("Created Admin user: admin@fms.internal / AdminPassword123!")
        else:
            print("Admin user already exists.")

        # 2. Member User
        member = db.query(User).filter(User.email == "member@fms.internal").first()
        if not member:
            member = User(
                name="Sarah Outreach",
                email="member@fms.internal",
                password_hash=get_password_hash("MemberPassword123!"),
                role=UserRole.member,
                is_active=True,
            )
            db.add(member)
            db.flush()
            print("Created Team Member user: member@fms.internal / MemberPassword123!")
        else:
            print("Member user already exists.")

        # 3. Seed Contacts if empty
        if db.query(Contact).count() == 0:
            now = datetime.now(timezone.utc)
            contacts_data = [
                {
                    "name": "Aarav Sharma",
                    "organization": "TechNova Corp",
                    "designation": "Lead Engineer",
                    "phone": "+919876543210",
                    "whatsapp": "+919876543210",
                    "email": "aarav.sharma@technova.example.com",
                    "city": "Bengaluru",
                    "source": "Hackathon 2026",
                    "contact_status": ContactStatus.interested,
                    "assigned_to_id": member.id,
                    "notes": "Highly interested in workshop track. Requested team discount details.",
                },
                {
                    "name": "Priya Nair",
                    "organization": "Apex Innovations",
                    "designation": "Product Lead",
                    "phone": "+919876543211",
                    "whatsapp": "+919876543211",
                    "email": "priya.nair@apex.example.com",
                    "city": "Mumbai",
                    "source": "Webinar Signup",
                    "contact_status": ContactStatus.follow_up_required,
                    "assigned_to_id": member.id,
                    "notes": "Asked to call back on Thursday afternoon.",
                },
                {
                    "name": "Rohan Deshmukh",
                    "organization": "MIT World Peace University",
                    "designation": "Research Scholar",
                    "phone": "+919876543212",
                    "whatsapp": "+919876543212",
                    "email": "rohan.d@mit.example.edu",
                    "city": "Pune",
                    "source": "Campus Drive",
                    "contact_status": ContactStatus.registered,
                    "assigned_to_id": admin.id,
                    "notes": "Completed formal registration.",
                },
                {
                    "name": "Ananya Patel",
                    "organization": "CloudScale Systems",
                    "designation": "DevOps Architect",
                    "phone": "+919876543213",
                    "whatsapp": "+919876543213",
                    "email": "ananya.patel@cloudscale.example.com",
                    "city": "Hyderabad",
                    "source": "Conference Lead",
                    "contact_status": ContactStatus.not_contacted,
                    "assigned_to_id": member.id,
                    "notes": "Imported from CSV. Needs initial call.",
                },
                {
                    "name": "Vikram Malhotra",
                    "organization": "Malhotra & Associates",
                    "designation": "Director",
                    "phone": "+919876543214",
                    "whatsapp": "+919876543214",
                    "email": "vikram@malhotra.example.com",
                    "city": "Delhi",
                    "source": "Referral",
                    "contact_status": ContactStatus.no_response,
                    "assigned_to_id": member.id,
                    "notes": "Called twice, phone went to voicemail.",
                },
            ]

            contacts = []
            for cd in contacts_data:
                c = Contact(**cd)
                db.add(c)
                contacts.append(c)
            db.flush()

            # Seed Attempts & Follow-Ups for Aarav
            att1 = ContactAttempt(
                contact_id=contacts[0].id,
                attempt_number=1,
                occurred_at=now - timedelta(days=2),
                method="phone_call",
                performed_by_id=member.id,
                outcome="reached",
                notes="Discussed event tracks and dates. Enthusiastic.",
            )
            db.add(att1)
            db.flush()

            fb1 = Feedback(
                contact_id=contacts[0].id,
                contact_attempt_id=att1.id,
                received_bool=True,
                feedback_date=now - timedelta(days=2),
                category="General Interest",
                details="Excited about the hands-on session. Wants group registration link.",
                followup_required_bool=True,
                next_followup_date=now + timedelta(days=1),
            )
            db.add(fb1)

            fu1 = FollowUp(
                contact_id=contacts[0].id,
                followup_date=now + timedelta(days=1),
                preferred_time="2:00 PM",
                reason="Send team discount coupon and link",
                assigned_to_id=member.id,
                status=FollowUpStatus.scheduled,
                priority="high",
            )
            db.add(fu1)

            # Seed Overdue Follow-Up for Priya
            fu2 = FollowUp(
                contact_id=contacts[1].id,
                followup_date=now - timedelta(hours=4),
                preferred_time="Morning",
                reason="Confirm attendance for keynote session",
                assigned_to_id=member.id,
                status=FollowUpStatus.scheduled,
                priority="normal",
            )
            db.add(fu2)

            # Seed Registration for Rohan
            reg1 = Registration(
                contact_id=contacts[2].id,
                status=RegistrationStatus.registered,
                registration_date=now - timedelta(days=1),
                registration_id_external="REG-2026-9041",
                registration_type="Academic",
                payment_status="paid",
                notes="Online gateway transaction successful.",
            )
            db.add(reg1)

            db.commit()
            print(f"Seeded {len(contacts)} sample contacts with timeline data!")
        else:
            print("Contacts already exist, skipping sample seed.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
