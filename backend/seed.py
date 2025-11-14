import time
from pymongo import MongoClient
from werkzeug.security import generate_password_hash
from faker import Faker
from datetime import datetime
from gridfs import GridFS
from bson import ObjectId
import io
import random # Import random for new fields

# Initialize Faker
fake = Faker()

# --- MongoDB Connection ---
try:
    client = MongoClient('mongodb://localhost:27017/', serverSelectionTimeoutMS=5000)
    client.server_info()
    db = client['user_auth_db']
    user_collection = db['users']
    fs = GridFS(db)
    print("Connected to MongoDB!")
except Exception as e:
    print(f"Error: Could not connect to MongoDB. Is it running? \n{e}")
    exit(1)
# --- End of DB Connection ---

def seed_database():
    """
    Clears and seeds the database with a full set of roles:
    1 Admin, 1 Employee, and 50 Users with files.
    """
    
    # --- 1. Clear ALL existing data ---
    print("Clearing all existing data...")
    user_collection.delete_many({})
    
    db['fs.files'].delete_many({})
    db['fs.chunks'].delete_many({})
    
    print("All collections cleared.")

    # --- 2. Create Admin ---
    print("Creating Admin account...")
    admin_user = {
        "name": "Admin User",
        "email": "admin@example.com",
        "password_hash": generate_password_hash("password123"),
        "role": "admin",
        "created_date": datetime.utcnow(),
        # --- *** THIS IS THE FIX *** ---
        "account_type": "management"
        # --- *** END OF FIX *** ---
    }
    user_collection.insert_one(admin_user)
    print(" > Admin created: admin@example.com / password123")

    # --- 3. Create Employee ---
    print("Creating Employee account...")
    employee_user = {
        "name": "Employee User",
        "email": "employee@example.com",
        "password_hash": generate_password_hash("password123"),
        "role": "employee",
        "created_date": datetime.utcnow(),
        # --- *** THIS IS THE FIX *** ---
        "account_type": "management"
        # --- *** END OF FIX *** ---
    }
    user_collection.insert_one(employee_user)
    print(" > Employee created: employee@example.com / password123")

    # --- 4. Create Dummy 'Users' with Files ---
    print(f"Creating 50 dummy 'user' accounts with files...")
    users_to_insert = []
    
    account_types = ['personal', 'professional', 'academic'] # Define options
    
    for i in range(50):
        first_name = fake.first_name()
        last_name = fake.last_name()
        name = f"{first_name} {last_name}"
        email = f"{first_name.lower()}.{last_name.lower()}{i}@example.com"
        
        gallery_files = []
        txt_content = f"Report for {name}\n\n{fake.paragraph(nb_sentences=10)}"
        txt_filename = f"{last_name}_report.txt"
        txt_file_id = fs.put(txt_content.encode('utf-8'), filename=txt_filename, content_type="text/plain")
        gallery_files.append({"id": str(txt_file_id), "filename": txt_filename})
        
        csv_content = "ID,Name,Email\n1,John,john@test.com\n2,Jane,jane@test.com"
        csv_filename = "data.csv"
        csv_file_id = fs.put(csv_content.encode('utf-8'), filename=csv_filename, content_type="text/csv")
        gallery_files.append({"id": str(csv_file_id), "filename": csv_filename})

        user = {
            "name": name,
            "email": email,
            "password_hash": generate_password_hash("password123"),
            "role": "user",
            "account_type": random.choice(account_types),
            "needs_sensitive_storage": fake.boolean(chance_of_getting_true=20),
            "created_date": fake.date_time_between(start_date="-2y", end_date="now"),
            "gallery": gallery_files,
            "profile_pic_id": None,
            "selected_date": fake.date_of_birth(minimum_age=18, maximum_age=65).isoformat(),
            "agreed_to_terms": True,
            "email_notifications": fake.boolean(),
        }
        users_to_insert.append(user)
        
    user_collection.insert_many(users_to_insert)
    print(f"Successfully created 50 'users' with fake files.")
    print("\nSeeding complete!")
    print("You can now log in as admin@example.com (password123) or employee@example.com (password123).")


if __name__ == '__main__':
    seed_database()