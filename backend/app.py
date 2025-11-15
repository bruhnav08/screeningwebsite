import time
from flask import Flask, request, jsonify, send_file, redirect
from flask_cors import CORS
from datetime import datetime as dt, timedelta, timezone 
import jwt
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import io
import re 

# --- MongoDB and GridFS Imports ---
from pymongo import MongoClient, DESCENDING, ASCENDING
from gridfs import GridFS
from bson import ObjectId
# --- End of Imports ---


app = Flask(__name__)
CORS(app)  # This enables Cross-Origin Resource Sharing
app.config['SECRET_KEY'] = 'your-super-secret-key-that-should-be-in-an-env-file'

# --- Constants ---
ERROR_MSG_18_PLUS = "User must be at least 18 years old."
ERROR_MSG_EMAIL_EXISTS = "This email address is already registered."
ERROR_MSG_ADMIN_REQUIRED = "Admin access required"
ERROR_MSG_USER_NOT_FOUND = "User not found"
# --- End of Constants ---

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
# --- End of DB Connection ---

# --- Helper Function to Serialize MongoDB Docs ---
def serialize_user(user, include_email=True):
    """
    Serializes a MongoDB user document into a JSON-friendly format.
    Includes all fields from the registration and user forms.
    """
    if not user:
        return None

    user_data = {
        "id": str(user['_id']),
        "name": user.get('name'),
        "role": user.get('role'),
        "account_type": "management" if user.get('role') in ['admin', 'employee'] else user.get('account_type', 'personal'),
        "needs_sensitive_storage": user.get('needs_sensitive_storage', False),
        "created_date": user.get('created_date', '').isoformat() if user.get('created_date') else None,
        "selected_date": user.get('selected_date'),
        "agreed_to_terms": user.get('agreed_to_terms'),
        "email_notifications": user.get('email_notifications'),
        "gallery": user.get('gallery', [])
    }

    if include_email:
        user_data['email'] = user.get('email')

    if user.get('profile_pic_id'):
        user_data['profile_pic'] = f"/profile_pic/{user_data['id']}?t={time.time()}"
    else:
        initials = user.get('name', 'U')[0].upper()
        user_data['profile_pic'] = f"https://placehold.co/150x150/E2D9FF/6842FF?text={initials}"

    return user_data
# --- End of Helper ---

# --- Age Validation Helper ---
def is_over_18(date_string):
    """Checks if a 'YYYY-MM-DD' date string is at least 18 years ago."""
    if not date_string:
        return True 
    try:
        dob = dt.strptime(date_string, '%Y-%m-%d').date()
        eighteen_years_ago = dt.now(timezone.utc).date() - timedelta(days=18*365.25)
        return dob <= eighteen_years_ago
    except ValueError:
        return False
# --- End of Helper ---

# --- Server-side Validation Helper ---
EMAIL_REGEX = r'^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,4}$'
ACCOUNT_TYPES = ['personal', 'professional', 'academic'] 

def _validate_password(password, is_create, data):
    """Helper to validate password rules."""
    if is_create:
        if not password or len(password) < 6:
            return "Password must be at least 6 characters long."
    # Check for password update
    elif 'password' in data and password and len(password) < 6:
        return "New password must be at least 6 characters long."
    return None

def validate_user_data(data, is_create=True, check_password=True):
    """Validates user data for creation or updates. Returns a list of error messages."""
    errors = []
    
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    account_type = data.get('account_type')

    # Validate Name
    if is_create or 'name' in data:
        if not name or len(name) < 2:
            errors.append("Name must be at least 2 characters long.")
    
    # Validate Email
    if is_create or 'email' in data:
        if not email or not re.match(EMAIL_REGEX, email.lower()):
            errors.append("Please provide a valid email address.")
    
    # Validate Password (using the helper)
    if check_password:
        password_error = _validate_password(password, is_create, data)
        if password_error:
            errors.append(password_error)
             
    # Validate Account Type
    if 'account_type' in data and account_type not in ACCOUNT_TYPES:
        errors.append("Invalid account type selected.")

    return errors


# --- Role-Based Security Helpers ---
def is_admin(user):
    return user.get('role', 'user').lower() == 'admin'

def is_employee_or_admin(user):
    return user.get('role', 'user').lower() in ['admin', 'employee']
# --- End Helpers ---


# --- Token Required Decorator (Middleware) ---
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            try:
                token = request.headers['Authorization'].split(" ")[1]
            except IndexError:
                return jsonify({"message": "Malformed 'Authorization' header"}), 401

        if not token:
            return jsonify({"message": "Token is missing"}), 401

        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            current_user = user_collection.find_one({"_id": ObjectId(data['user_id'])})
            if not current_user:
                 return jsonify({"message": "Token is invalid"}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({"message": "Token has expired"}), 401
        except Exception as e:
            return jsonify({"message": "Token is invalid", "error": str(e)}), 401

        return f(current_user, *args, **kwargs)
    return decorated
# --- END of Decorator ---

@app.route('/me', methods=['GET'])
@token_required
def get_me(current_user):
    return jsonify(serialize_user(current_user, include_email=True)), 200


# --- Authentication Routes ---

@app.route('/register', methods=['POST'])
def register():
    data = request.form
    email = data.get('email', '').lower()
    selected_date = data.get('selected_date')

    errors = validate_user_data(data, is_create=True, check_password=True)
    
    if selected_date and not is_over_18(selected_date):
        errors.append(ERROR_MSG_18_PLUS)
        
    if user_collection.find_one({"email": email}):
        errors.append(ERROR_MSG_EMAIL_EXISTS)
    
    if errors:
        return jsonify({"message": "\n".join(errors)}), 400
    
    name = data.get('name')
    password = data.get('password')
    password_hash = generate_password_hash(password)

    profile_pic_id = None
    if 'profile_pic' in request.files:
        file = request.files['profile_pic']
        if file.filename != '':
            filename = secure_filename(file.filename)
            file_id = fs.put(file, filename=filename, content_type=file.mimetype)
            profile_pic_id = str(file_id)

    gallery_files = []
    if 'gallery' in request.files:
        files = request.files.getlist('gallery')
        for file in files:
            if file.filename != '':
                filename = secure_filename(file.filename)
                file_id = fs.put(file, filename=filename, content_type=file.mimetype)
                gallery_files.append({
                    "id": str(file_id),
                    "filename": filename
                })

    new_user = {
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": "user", 
        "account_type": data.get('account_type', 'personal'),
        "needs_sensitive_storage": data.get('needs_sensitive_storage') == 'true',
        "created_date": dt.now(timezone.utc),
        "profile_pic_id": profile_pic_id,
        "selected_date": selected_date,
        "agreed_to_terms": data.get('agreed_to_terms') == 'true',
        "email_notifications": data.get('email_notifications') == 'true',
        "gallery": gallery_files
    }
    
    result = user_collection.insert_one(new_user)
    new_user_id = str(result.inserted_id)

    token = jwt.encode(
        {
            'user_id': new_user_id,
            'exp': dt.now(timezone.utc) + timedelta(hours=24)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )
    return jsonify({"message": "Registration successful", "token": token, "role": "user"}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').lower()
    password = data.get('password')

    if not email or not password:
        return jsonify({"message": "Email and password are required"}), 400

    user = user_collection.find_one({"email": email})

    if user and check_password_hash(user['password_hash'], password):
        user_id_str = str(user['_id'])
        user_role = user.get('role', 'user').lower()
        
        if user_role in ['admin', 'employee']:
            expires = dt.now(timezone.utc) + timedelta(hours=1)
        else:
            expires = dt.now(timezone.utc) + timedelta(hours=24)
        
        token = jwt.encode(
            {
                'user_id': user_id_str,
                'exp': expires
            },
            app.config['SECRET_KEY'],
            algorithm="HS256"
        )
        return jsonify({"message": "Login successful", "token": token, "role": user_role}), 200
    else:
        return jsonify({"message": "Invalid email or password"}), 401


@app.route('/profile_pic/<string:user_id>', methods=['GET'])
def get_profile_pic(user_id):
    try:
        user = user_collection.find_one({"_id": ObjectId(user_id)})
        if not user or not user.get('profile_pic_id'):
            initials = user.get('name', 'U')[0].upper()
            return redirect(f"https://placehold.co/150x150/E2D9FF/6842FF?text={initials}")

        profile_pic_file = fs.get(ObjectId(user['profile_pic_id']))
        
        return send_file(
            io.BytesIO(profile_pic_file.read()),
            mimetype=profile_pic_file.content_type,
            as_attachment=False
        )
    except Exception as e:
        print(f"Error getting profile pic: {e}")
        return redirect("https://placehold.co/150x150/E2D9FF/6842FF?text=X")


# --- File Handling Routes ---

@app.route('/file/<string:file_id>', methods=['GET'])
@token_required
def get_file(current_user, file_id):
    try:
        file_to_download = fs.get(ObjectId(file_id))
        
        file_owner = user_collection.find_one({"gallery.id": file_id})

        is_staff = is_employee_or_admin(current_user)
        is_owner = file_owner and str(file_owner['_id']) == str(current_user['_id'])

        if not is_staff and not is_owner:
            return jsonify({"message": "Access denied"}), 403
        
        return send_file(
            io.BytesIO(file_to_download.read()),
            mimetype=file_to_download.content_type,
            as_attachment=True,
            download_name=file_to_download.filename
        )
            
    except Exception as e:
        print(f"Error getting file: {e}")
        return jsonify({"message": "File not found or invalid ID"}), 404

@app.route('/upload', methods=['POST'])
@token_required
def upload_files(current_user):
    if current_user.get('role', 'user').lower() != 'user':
        return jsonify({"message": "Only users can upload files"}), 403
        
    if 'files_to_upload' not in request.files:
        return jsonify({"message": "No 'files_to_upload' field in form"}), 400
        
    files = request.files.getlist('files_to_upload')
    if not files or files[0].filename == '':
        return jsonify({"message": "No selected files"}), 400
        
    uploaded_file_list = []
    
    for file in files:
        if file.filename != '':
            filename = secure_filename(file.filename)
            file_id = fs.put(file, filename=filename, content_type=file.mimetype)
            file_obj = {
                "id": str(file_id),
                "filename": filename
            }
            uploaded_file_list.append(file_obj)

    user_collection.update_one(
        {"_id": current_user['_id']},
        {"$push": {"gallery": {"$each": uploaded_file_list}}}
    )
    
    return jsonify({"message": f"Successfully uploaded {len(uploaded_file_list)} files."}), 201

@app.route('/my-files', methods=['GET'])
@token_required
def get_my_files(current_user):
    if current_user.get('role', 'user').lower() != 'user':
        return jsonify({"message": "Only users can see their files"}), 403
        
    updated_user = user_collection.find_one({"_id": current_user['_id']})
    return jsonify(updated_user.get('gallery', [])), 200

@app.route('/my-profile', methods=['PUT'])
@token_required
def update_my_profile(current_user):
    if current_user.get('role', 'user').lower() != 'user':
        return jsonify({"message": "Only users can update their profile"}), 403
    
    data = request.json
    
    errors = validate_user_data(data, is_create=False, check_password=True)
    if errors:
        return jsonify({"message": "\n".join(errors)}), 400
    
    updates = {
        "name": data.get('name'),
        "email_notifications": data.get('email_notifications') == 'true' or data.get('email_notifications') == True,
    }
    
    if 'password' in data and data['password']:
        updates['password_hash'] = generate_password_hash(data['password'])

    user_collection.update_one({"_id": current_user['_id']}, {"$set": updates})
    updated_user = user_collection.find_one({"_id": current_user['_id']})
    return jsonify(serialize_user(updated_user, include_email=True)), 200

@app.route('/my-profile/pic', methods=['POST'])
@token_required
def update_my_profile_pic(current_user):
    if current_user.get('role', 'user').lower() != 'user':
        return jsonify({"message": "Only users can update their profile pic"}), 403
    
    if 'profile_pic' not in request.files:
        return jsonify({"message": "No 'profile_pic' file found in form"}), 400
    
    file = request.files['profile_pic']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400

    if current_user.get('profile_pic_id'):
        try:
            fs.delete(ObjectId(current_user['profile_pic_id']))
        except Exception as e:
            print(f"Old profile pic not found or cound not be deleted: {e}")

    filename = secure_filename(file.filename)
    file_id = fs.put(file, filename=filename, content_type=file.mimetype)
    new_profile_pic_id = str(file_id)
    
    user_collection.update_one(
        {"_id": current_user['_id']},
        {"$set": {"profile_pic_id": new_profile_pic_id}}
    )
    
    updated_user = user_collection.find_one({"_id": current_user['_id']})
    return jsonify(serialize_user(updated_user, include_email=True)), 200


@app.route('/admin/create-user', methods=['POST'])
@token_required
def admin_create_user(current_user):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403

    data = request.form
    email = data.get('email', '').lower()
    selected_date = data.get('selected_date')

    errors = validate_user_data(data, is_create=True, check_password=True)
    
    if selected_date and not is_over_18(selected_date):
        errors.append(ERROR_MSG_18_PLUS)
        
    if user_collection.find_one({"email": email}):
        errors.append(ERROR_MSG_EMAIL_EXISTS)
    
    if errors:
        return jsonify({"message": "\n".join(errors)}), 400

    name = data.get('name')
    password = data.get('password')
    password_hash = generate_password_hash(password)

    profile_pic_id = None
    if 'profile_pic' in request.files:
        file = request.files['profile_pic']
        if file.filename != '':
            filename = secure_filename(file.filename)
            file_id = fs.put(file, filename=filename, content_type=file.mimetype)
            profile_pic_id = str(file_id)

    new_user = {
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": "user", 
        "account_type": data.get('account_type', 'personal'),
        "needs_sensitive_storage": data.get('needs_sensitive_storage') == 'true',
        "created_date": dt.now(timezone.utc),
        "profile_pic_id": profile_pic_id,
        "selected_date": selected_date,
        "gallery": []
    }
    
    result = user_collection.insert_one(new_user)
    new_user['_id'] = result.inserted_id
    
    return jsonify(serialize_user(new_user, include_email=True)), 201


@app.route('/admin/update-user/<string:user_id>', methods=['POST'])
@token_required
def admin_update_user(current_user, user_id):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403
    
    try:
        user_to_update = user_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return jsonify({"message": ERROR_MSG_USER_NOT_FOUND}), 404

    if not user_to_update:
        return jsonify({"message": ERROR_MSG_USER_NOT_FOUND}), 404
        
    if user_to_update.get('role') != 'user':
        return jsonify({"message": "This endpoint is only for editing 'user' roles"}), 400

    data = request.form
    errors = _validate_admin_user_update(data, user_to_update)
    if errors:
        return jsonify({"message": "\n".join(errors)}), 400

    updates = _build_admin_user_updates(data)

    if 'profile_pic' in request.files:
        file = request.files['profile_pic']
        if file.filename != '':
            updates['profile_pic_id'] = _handle_admin_profile_pic_update(file, user_to_update)

    if updates:
         user_collection.update_one({"_id": ObjectId(user_id)}, {"$set": updates})
         
    updated_user = user_collection.find_one({"_id": ObjectId(user_id)})
    return jsonify(serialize_user(updated_user, include_email=True)), 200

# --- These helpers are used by admin_update_user ---
def _validate_admin_user_update(data, user_to_update):
    """Helper to validate admin updates for a user."""
    errors = validate_user_data(data, is_create=False, check_password=True)
    user_id = str(user_to_update['_id'])
    
    selected_date = data.get('selected_date')
    if selected_date and not is_over_18(selected_date):
        errors.append(ERROR_MSG_18_PLUS)

    email = data.get('email', '').lower()
    if email and email != user_to_update.get('email'):
        existing_user = user_collection.find_one({"email": email})
        if existing_user and str(existing_user['_id']) != user_id:
            errors.append(ERROR_MSG_EMAIL_EXISTS)
    
    if data.get('account_type') == 'management':
        errors.append("Cannot assign 'management' account type to a 'user' role.")
        
    return errors

def _build_admin_user_updates(data):
    """Helper to build the $set dictionary for user updates."""
    updates = {
        "name": data.get('name'),
        "selected_date": data.get('selected_date'),
        "email": data.get('email', '').lower(),
        "account_type": data.get('account_type'),
        "needs_sensitive_storage": data.get('needs_sensitive_storage') == 'true',
    }
    updates = {k: v for k, v in updates.items() if v is not None}
    
    if data.get('password'):
        updates['password_hash'] = generate_password_hash(data['password'])
    
    return updates

def _handle_admin_profile_pic_update(file, user_to_update):
    """Helper to delete old pic and save new one."""
    if user_to_update.get('profile_pic_id'):
        try:
            fs.delete(ObjectId(user_to_update['profile_pic_id']))
        except Exception as e:
            print(f"Old pic not found: {e}")
    
    filename = secure_filename(file.filename)
    file_id = fs.put(file, filename=filename, content_type=file.mimetype)
    return str(file_id)


# --- Admin/Dashboard Routes ---

# --- START: REFACTOR FOR L566 (Cognitive Complexity) ---
#
# Reason: The old _build_user_query was 17 complexity.
# We break it into 5 small functions, each with a complexity of ~2-3.
# The new _build_user_query just calls them and has a complexity of 0.

def _add_search_filter(search, query_filters):
    """Adds search filter to query_filters list."""
    if search:
        query_filters.append({
            "$or": [
                {"name": {"$regex": search, "$options": "i"}},
                {"email": {"$regex": search, "$options": "i"}},
            ]
        })

def _add_list_filter(list_str, field_name, query_filters):
    """Adds a list filter (e.g., for roles) to query_filters list."""
    if list_str:
        item_list = list_str.split(',')
        if item_list:
            query_filters.append({field_name: {"$in": item_list}})

def _add_sensitivity_filter(sensitivity_str, query_filters):
    """Adds sensitivity filter to query_filters list."""
    if sensitivity_str == 'true':
        query_filters.append({"needs_sensitive_storage": True})
    elif sensitivity_str == 'false':
        query_filters.append({"needs_sensitive_storage": False})

def _add_date_filter(start_date_str, end_date_str, query_filters):
    """Adds date range filter to query_filters list."""
    date_query = {}
    if start_date_str:
        try:
            date_query['$gte'] = dt.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            pass  # Ignore invalid date
    if end_date_str:
        try:
            end_dt = dt.strptime(end_date_str, '%Y-%m-%d') + timedelta(days=1, microseconds=-1)
            date_query['$lte'] = end_dt
        except ValueError:
            pass  # Ignore invalid date
    
    if date_query:
        query_filters.append({"created_date": date_query})

def _build_user_query(args):
    """Helper function to build the MongoDB query from request args."""
    query_filters = []
    
    _add_search_filter(args.get('search', ''), query_filters)
    _add_list_filter(args.get('roles', ''), "role", query_filters)
    _add_list_filter(args.get('account_types', ''), "account_type", query_filters)
    _add_sensitivity_filter(args.get('sensitivity', ''), query_filters)
    _add_date_filter(args.get('start_date', ''), args.get('end_date', ''), query_filters)

    return {"$and": query_filters} if query_filters else {}
# --- END: REFACTOR FOR L566 ---


@app.route('/users', methods=['GET'])
@token_required
def get_users(current_user):
    if not is_employee_or_admin(current_user):
        return jsonify({"message": "Dashboard access required"}), 403
        
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 10))
    sort_by = request.args.get('sort_by', 'name')
    sort_order_str = request.args.get('sort_order', 'asc')
    sort_order = ASCENDING if sort_order_str == 'asc' else DESCENDING
    
    # Build query using the helper
    query = _build_user_query(request.args)
        
    total_users = user_collection.count_documents(query)
    total_pages = (total_users + limit - 1) // limit
    
    users_cursor = user_collection.find(query)\
                                  .sort(sort_by, sort_order)\
                                  .skip((page - 1) * limit)\
                                  .limit(limit)

    users_safe = [serialize_user(user, include_email=True) for user in users_cursor]

    return jsonify({
        "users": users_safe,
        "page": page,
        "limit": limit,
        "total_users": total_users,
        "total_pages": total_pages
    })

@app.route('/users/<string:user_id>', methods=['GET'])
@token_required
def get_user(current_user, user_id):
    if not is_employee_or_admin(current_user):
        return jsonify({"message": "Dashboard access required"}), 403
        
    try:
        user = user_collection.find_one({"_id": ObjectId(user_id)})
        if user:
            return jsonify(serialize_user(user, include_email=True)), 200
        return jsonify({"message": ERROR_MSG_USER_NOT_FOUND}), 404
    except Exception:
        return jsonify({"message": "Invalid User ID"}), 400

@app.route('/users', methods=['POST'])
@token_required
def create_user(current_user):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403
        
    data = request.json
    email = data.get('email', '').lower()
    selected_date = data.get('selected_date')
    role = data.get('role', 'employee')

    errors = validate_user_data(data, is_create=True, check_password=True)

    if role not in ['admin', 'employee']:
        errors.append("New staff role must be 'admin' or 'employee'.")
        
    if selected_date and not is_over_18(selected_date):
        errors.append(ERROR_MSG_18_PLUS)

    if user_collection.find_one({"email": email}):
        errors.append(ERROR_MSG_EMAIL_EXISTS)
        
    if errors:
        return jsonify({"message": "\n".join(errors)}), 400
        
    name = data.get('name')
    password = data.get('password')
    password_hash = generate_password_hash(password)
    
    new_user = {
        "name": name,
        "email": email,
        "password_hash": password_hash,
        "role": role,
        "created_date": dt.now(timezone.utc),
        "selected_date": selected_date,
        "account_type": "management"
    }
    result = user_collection.insert_one(new_user)
    new_user['_id'] = result.inserted_id
    
    return jsonify(serialize_user(new_user, include_email=True)), 201


# --- Staff Update Validation Helpers (for L565 fix) ---
def _validate_staff_name(data, errors):
    """Validates name for staff update."""
    name = data.get('name')
    if 'name' in data and (not name or len(name) < 2):
        errors.append("Name must be at least 2 characters long.")

def _validate_staff_email(data, user_to_update, errors):
    """Validates email for staff update."""
    email = data.get('email', '').lower()
    if 'email' in data and (not email or not re.match(EMAIL_REGEX, email.lower())):
        errors.append("Please provide a valid email address.")
    elif email and email != user_to_update.get('email'):
        existing_user = user_collection.find_one({"email": email})
        if existing_user and str(existing_user['_id']) != str(user_to_update['_id']):
            errors.append(ERROR_MSG_EMAIL_EXISTS)

def _validate_staff_password(data, errors):
    """Validates password for staff update."""
    password = data.get('password')
    if 'password' in data and password and len(password) < 6:
            errors.append("New password must be at least 6 characters long.")

def _validate_staff_role(data, errors):
    """Validates role for staff update."""
    role = data.get('role')
    if role and role not in ['admin', 'employee']:
            errors.append("Role can only be 'admin' or 'employee'.")

def _validate_staff_dob(data, errors):
    """Validates date of birth for staff update."""
    selected_date = data.get('selected_date')
    if selected_date and not is_over_18(selected_date):
        errors.append(ERROR_MSG_18_PLUS)

def _validate_staff_update(data, user_to_update):
    """Helper to validate admin updates for a staff member."""
    errors = []
    _validate_staff_name(data, errors)
    _validate_staff_email(data, user_to_update, errors)
    _validate_staff_password(data, errors)
    _validate_staff_role(data, errors)
    _validate_staff_dob(data, errors)
    return errors

@app.route('/users/<string:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403

    try:
        user_to_update = user_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
         return jsonify({"message": "Invalid User ID"}), 400

    if not user_to_update:
        return jsonify({"message": ERROR_MSG_USER_NOT_FOUND}), 404
            
    if user_to_update.get('role') not in ['admin', 'employee']:
        return jsonify({"message": "This route is only for updating staff roles"}), 400
            
    data = request.json
    
    errors = _validate_staff_update(data, user_to_update)
    if errors:
        return jsonify({"message": "\n".join(errors)}), 400

    updates = {
        "name": data.get('name'),
        "role": data.get('role'),
        "selected_date": data.get('selected_date'),
        "email": data.get('email', '').lower()
    }
    
    updates = {k: v for k, v in updates.items() if v} 
    
    if 'password' in data and data['password']:
        updates['password_hash'] = generate_password_hash(data['password'])

    if updates:
        user_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": updates}
        )
    
    updated_user = user_collection.find_one({"_id": ObjectId(user_id)})
    return jsonify(serialize_user(updated_user, include_email=True)), 200


# --- User Deletion Helpers (for Complexity) ---

def _delete_user_gallery_files(user_to_delete):
    """Helper to delete all files in a user's gallery."""
    if user_to_delete.get('role') == 'user' and 'gallery' in user_to_delete:
        print(f"User {user_to_delete['_id']} is a 'user'. Deleting their {len(user_to_delete['gallery'])} files...")
        for file_obj in user_to_delete['gallery']:
            try:
                fs.delete(ObjectId(file_obj['id']))
                print(f"  > Deleted file {file_obj['id']} ({file_obj['filename']})")
            except Exception as e:
                print(f"  > Error deleting file {file_obj['id']}: {e}")

def _delete_user_profile_pic(user_to_delete):
    """Helper to delete a user's profile picture."""
    if user_to_delete.get('profile_pic_id'):
        try:
            fs.delete(ObjectId(user_to_delete['profile_pic_id']))
            print(f"  > Deleted profile pic {user_to_delete['profile_pic_id']}")
        except Exception as e:
            print(f"  > Error deleting profile pic: {e}")

@app.route('/users/<string:user_id>', methods=['DELETE'])
@token_required
def delete_user(current_user, user_id):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403
        
    try:
        user_to_delete = user_collection.find_one({"_id": ObjectId(user_id)})
        if not user_to_delete:
            return jsonify({"message": ERROR_MSG_USER_NOT_FOUND}), 404

        # Call helpers to do the complex work
        _delete_user_gallery_files(user_to_delete)
        _delete_user_profile_pic(user_to_delete)
                
        # Now the main function just deletes the user
        user_collection.delete_one({"_id": ObjectId(user_id)})
            
        return jsonify({"message": "User and all associated files deleted"}), 200
    except Exception as e:
        print(f"Error deleting user: {e}")
        return jsonify({"message": "Invalid User ID or deletion error"}), 400


@app.route('/admin/user/<string:user_id>/file', methods=['POST'])
@token_required
def admin_add_file_to_user(current_user, user_id):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403
        
    user = user_collection.find_one({"_id": ObjectId(user_id)})
    if not user or user.get('role') != 'user':
        return jsonify({"message": "Files can only be added to 'user' roles"}), 400
        
    if 'file' not in request.files:
        return jsonify({"message": "No 'file' field in form"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"message": "No selected file"}), 400
        
    filename = secure_filename(file.filename)
    file_id = fs.put(file, filename=filename, content_type=file.mimetype)
    file_obj = {
        "id": str(file_id),
        "filename": filename
    }

    user_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$push": {"gallery": file_obj}}
    )
    
    return jsonify({"message": "File added successfully", "file": file_obj}), 201

@app.route('/admin/user/file/<string:file_id>', methods=['DELETE'])
@token_required
def admin_delete_file(current_user, file_id):
    if not is_admin(current_user):
        return jsonify({"message": ERROR_MSG_ADMIN_REQUIRED}), 403
        
    try:
        user = user_collection.find_one({"gallery.id": file_id})
        if not user:
            return jsonify({"message": "File not found in any user gallery"}), 404
            
        fs.delete(ObjectId(file_id))
        
        user_collection.update_one(
            {"_id": user['_id']},
            {"$pull": {"gallery": {"id": file_id}}}
        )
        
        return jsonify({"message": "File deleted successfully"}), 200
    except Exception as e:
        print(f"Error deleting file: {e}")
        return jsonify({"message": "File not found or invalid ID"}), 404
        

if __name__ == '__main__':
    app.run(debug=True, port=5000)