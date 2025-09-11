const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module').AppModule;

async function debug() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Get services
  const enforcer = app.get('CASBIN_ENFORCER');
  const usersRepository = app.get('UsersRepository');
  
  console.log('=== Debugging Roles Issue ===');
  
  // Get all users
  const users = await usersRepository.findAll();
  console.log('Users:', users.map(u => ({ id: u.id, email: u.email })));
  
  // Get all grouping policies
  const groupingPolicies = await enforcer.getGroupingPolicy();
  console.log('Grouping Policies:', groupingPolicies);
  
  // Test getRolesForUser for a specific user
  const hrUser = users.find(u => u.email === 'hr.user@example.com');
  if (hrUser) {
    console.log(`Checking roles for HR user (ID: ${hrUser.id})`);
    const roles = await enforcer.getGroupingPolicy();
    const userPolicies = roles.filter(p => p[0] === hrUser.id);
    console.log('User policies:', userPolicies);
  }
  
  await app.close();
}

debug().catch(console.error);