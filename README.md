# NestJS Casbin Starter - ABAC Request Approval System

A comprehensive **Attribute-Based Access Control (ABAC)** system built with **NestJS** and **Casbin** for managing multi-stage request approval workflows across departments.

## 🚀 Features

- **🔐 ABAC with Casbin**: Domain-based role assignments with cross-department permissions
- **👥 User Management**: Create users with automatic department and role assignment
- **🏢 Department Management**: Create departments with automatic policy generation
- **📋 Request Workflow**: Multi-stage approval process (DEPT_HEAD → AF_REVIEW → CG_REVIEW)
- **🎯 Role-Based Permissions**: STAFF, HD, AF_APPROVER, CG_APPROVER roles
- **🌐 Modern UI**: React frontend with Material-UI components
- **🔄 Real-time Updates**: Dynamic permission checking and UI updates

## 🏗️ Architecture

### Backend (NestJS)
- **Framework**: NestJS with TypeScript
- **Database**: PostgreSQL with TypeORM
- **Access Control**: Casbin RBAC with domains
- **Validation**: class-validator decorators
- **Port**: 9000

### Frontend (React)
- **Framework**: React with JavaScript
- **UI Library**: Material-UI (MUI)
- **State Management**: React hooks
- **Port**: 8000

## 📋 Prerequisites

- Node.js (v16+)
- PostgreSQL database
- npm or yarn package manager

## ⚡ Quick Start

### 1. Clone Repository
```bash
git clone <repository-url>
cd nest-casbin-starter
```

### 2. Setup Backend
```bash
cd backend
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations and seed data
npm run db:reset
npm run seed

# Start development server
npm run start:dev
```

### 3. Setup Frontend
```bash
cd frontend
npm install

# Start development server
npm start
```

### 4. Access Application
- **Frontend**: http://localhost:8000
- **Backend API**: http://localhost:9000

## 🗂️ Project Structure

```
nest-casbin-starter/
├── backend/                    # NestJS backend
│   ├── src/
│   │   ├── common/
│   │   │   ├── auth/          # Authentication & authorization
│   │   │   ├── casbin/        # Casbin configuration
│   │   │   │   ├── model.conf # ABAC model definition
│   │   │   │   └── policy.seed.ts # Initial policies
│   │   │   └── entities/      # TypeORM entities
│   │   ├── users/             # User management module
│   │   ├── departments/       # Department management module
│   │   ├── requests/          # Request workflow module
│   │   └── approvals/         # Approval logic module
│   └── package.json
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── App.js            # Main application
│   │   ├── CreateUser.js     # User creation dialog
│   │   ├── CreateDepartment.js # Department creation dialog
│   │   └── Requests.js       # Request management
│   └── package.json
├── CONFLUENCE.md              # Detailed technical documentation
└── README.md                  # This file
```

## 🔑 ABAC Model

### Access Control Matrix

| Role | Domain | Permissions |
|------|--------|-------------|
| **STAFF** | Department | `requests`: view, create, edit |
| **HD** | Department | `requests`: view, create, edit, approve:DEPT_HEAD |
| **AF_APPROVER** | `*` (Global) | `requests`: approve:AF_REVIEW |
| **CG_APPROVER** | `*` (Global) | `requests`: approve:CG_REVIEW, view:AF_REVIEW |

### Casbin Model Configuration
```conf
[request_definition]
r = sub, dom, obj, act

[policy_definition]
p = sub, dom, obj, act

[role_definition]
g = _, _, _

[matchers]
m = (g(r.sub, p.sub, r.dom) || g(r.sub, p.sub, "*")) && (r.dom == p.dom || p.dom == "*") && r.obj == p.obj && r.act == p.act
```

## 🔄 Request Workflow

### Approval Stages
1. **DRAFT** → User creates and edits request
2. **DEPT_HEAD** → Department head approval
3. **AF_REVIEW** → Accounting & Financial review
4. **CG_REVIEW** → Corporate Strategy final approval
5. **APPROVED/REJECTED** → Final status

### Stage Transitions
- **STAFF**: Can create and submit requests in their department
- **HD**: Can approve at DEPT_HEAD stage for their department
- **AF_APPROVER**: Can approve at AF_REVIEW stage for any department
- **CG_APPROVER**: Can approve at CG_REVIEW stage + view AF_REVIEW stage

## 👥 User Roles & Permissions

### Department-Specific Roles
- **STAFF**: Basic department member
  - Create, edit, and submit requests in own department
  - View own department's requests

- **HD (Head of Department)**: Department leader
  - All STAFF permissions
  - Approve requests at DEPT_HEAD stage
  - Can create requests that bypass DEPT_HEAD if they're the only HD

### Cross-Department Roles
- **AF_APPROVER**: Automatic role for AF department users
  - Can approve any request at AF_REVIEW stage
  - Global permissions across all departments

- **CG_APPROVER**: Automatic role for CG department users
  - Can approve any request at CG_REVIEW stage
  - Early visibility into AF_REVIEW stage (view-only)
  - Global permissions across all departments

## 🏢 Department Management

### Creating Departments
When a new department is created, the system automatically:

1. **Creates Department Entity**: Saves to database with code and name
2. **Generates Casbin Policies**: Auto-creates permission policies:
   ```sql
   -- HD permissions for new department
   ('p', 'HD', 'NEW_DEPT', 'requests', 'view')
   ('p', 'HD', 'NEW_DEPT', 'requests', 'create')
   ('p', 'HD', 'NEW_DEPT', 'requests', 'edit')
   ('p', 'HD', 'NEW_DEPT', 'requests', 'approve:DEPT_HEAD')
   
   -- STAFF permissions for new department
   ('p', 'STAFF', 'NEW_DEPT', 'requests', 'view')
   ('p', 'STAFF', 'NEW_DEPT', 'requests', 'create')
   ('p', 'STAFF', 'NEW_DEPT', 'requests', 'edit')
   ```

### Department Validation
- **Code**: 2-5 uppercase letters (e.g., HR, IT, MKT)
- **Name**: 3-50 characters (e.g., Human Resources)
- **Uniqueness**: Department codes must be unique

## 👤 User Creation Process

### Automatic Role Assignment
When creating a user, the system:

1. **Validates Department**: Ensures department exists
2. **Creates User Entity**: Saves basic user information
3. **Assigns Primary Role**: Creates Casbin rule `g(user_id, role, department)`
4. **Assigns Special Roles**: For AF/CG departments:
   ```typescript
   // AF users get cross-department approver role
   if (department === 'AF') {
     await enforcer.addRoleForUser(userId, 'AF_APPROVER', '*');
   }
   
   // CG users get cross-department approver role
   if (department === 'CG') {
     await enforcer.addRoleForUser(userId, 'CG_APPROVER', '*');
   }
   ```

### User Validation
- **Display Name**: Required, 1-100 characters
- **Email**: Valid email format, unique
- **Department**: Must exist in system
- **Role**: STAFF or HD

## 🛠️ API Endpoints

### Users
- `GET /users` - List all users with roles
- `POST /users` - Create new user with department/role assignment

### Departments
- `GET /departments` - List all departments
- `GET /departments/creatable` - List departments user can create requests in
- `POST /departments` - Create new department with auto-policy generation

### Requests
- `GET /requests?departmentId=<id>` - List department requests
- `GET /requests/reviewable` - List requests user can review
- `POST /requests` - Create new request
- `POST /requests/:id/submit` - Submit draft request
- `POST /requests/:id/approve` - Approve/reject request

## 🔧 Configuration

### Environment Variables (.env)
```env
DATABASE_URL=postgresql://username:password@localhost:5432/dbname
JWT_SECRET=your-jwt-secret
NODE_ENV=development
```

### Database Setup
```bash
# Reset database and seed initial data
npm run db:reset
npm run seed
```

### CORS Configuration
Backend is configured to accept requests from frontend:
```typescript
app.enableCors({
  origin: 'http://localhost:8000',
  credentials: true,
});
```

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test                    # Unit tests
npm run test:e2e           # End-to-end tests
```

### Frontend Tests
```bash
cd frontend
npm test                    # React component tests
```

## 🚀 Deployment

### Production Build
```bash
# Backend
cd backend
npm run build
npm start

# Frontend
cd frontend
npm run build
# Serve build/ directory with web server
```

### Docker Support
```dockerfile
# Example Dockerfile for backend
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 9000
CMD ["npm", "run", "start:prod"]
```

## 📚 Key Concepts

### ABAC vs RBAC
This system demonstrates **Attribute-Based Access Control (ABAC)** using Casbin's RBAC with domains:
- **Subject**: User ID
- **Domain**: Department code or wildcard (*)
- **Object**: Resource type (requests, users, departments)
- **Action**: Operation (create, view, edit, approve:STAGE)

### Domain-Based Permissions
- Department-specific roles are isolated by domain
- Cross-department roles use wildcard domain (`*`)
- Permissions are checked against both specific and wildcard domains

### Dynamic Permission Checking
The UI dynamically shows/hides actions based on real-time permission checks:
```typescript
// Example: Only show "Submit" button if user can submit
if (await casbin.enforce(userId, department, 'requests', 'edit')) {
  permittedActions.push('submit');
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For questions and support:
- Check the [CONFLUENCE.md](./CONFLUENCE.md) for detailed technical documentation
- Review the code comments and examples
- Open an issue on GitHub

## 🔗 Related Documentation

- [Casbin Documentation](https://casbin.org/)
- [NestJS Documentation](https://nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)
- [Material-UI Documentation](https://mui.com/)

---

Built with ❤️ using NestJS, Casbin, React, and PostgreSQL