// Simple n8n client implementation that works like it did at commit 11b5be1
// This creates mock users for development and real users when API key is available

export interface N8nUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  inviteAcceptUrl?: string;
  invitation_link?: string;
}

export interface N8nProject {
  id: string;
  name: string;
  type?: string;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
}

export class N8nClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.N8N_API_URL || '';
    this.apiKey = process.env.N8N_API_KEY || '';
  }

  async getUserByEmail(email: string): Promise<N8nUser | null> {
    if (!this.apiKey) {
      console.error('❌ N8N_API_KEY not configured');
      return null;
    }

    try {
      console.log('🔍 Fetching n8n user by email:', email);

      const response = await fetch(`${this.baseUrl}/api/v1/users`, {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
        },
      });

      if (!response.ok) {
        console.error('❌ Failed to fetch n8n users:', response.status);
        return null;
      }

      const response_data = await response.json();
      const users = response_data.data || response_data; // Handle both {data: []} and [] formats
      console.log('📋 Total n8n users found:', users.length);

      const user = users.find((u: any) => u.email === email);

      if (user) {
        console.log('✅ Found existing n8n user:', user.id);
        const inviterId = process.env.N8N_INVITER_ID || '';
        const invitationLink = `${this.baseUrl}/signup?inviterId=${inviterId}&inviteeId=${user.id}&redirect=/workflow/new`;

        return {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          inviteAcceptUrl: invitationLink,
          invitation_link: invitationLink,
        };
      }

      console.log('❌ User not found in n8n');
      return null;
    } catch (error) {
      console.error('❌ Error fetching n8n user:', error);
      return null;
    }
  }

  async createUser(userData: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    role?: string;
  }): Promise<N8nUser> {
    console.log('👤 Creating n8n user for:', userData.email);
    console.log('🏭 PRODUCTION MODE - Using discovered n8n API syntax');

    // In production, we MUST have an API key
    if (!this.apiKey || this.apiKey === '' || this.apiKey.includes('your_n8n_api_key_here')) {
      console.error('❌ PRODUCTION ERROR: N8N_API_KEY is missing or not configured!');
      console.error('❌ Cannot create real n8n invitations without proper API key');
      throw new Error('N8N_API_KEY is required in production environment');
    }

    try {
      console.log('🔑 Using n8n API with key: [redacted]');
      console.log('🌐 API endpoint:', `${this.baseUrl}/api/v1/users`);

      // CRITICAL: n8n API expects an ARRAY of users, not a single object!
      const userPayload = {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'global:member',
      };

      // Add password only if provided (n8n can work without it for invitations)
      if ((userData as any).password) {
        (userPayload as any).password = (userData as any).password;
      }

      console.log('📤 Request payload (ARRAY FORMAT):', [
        { ...userPayload, password: (userData as any).password ? '[REDACTED]' : 'not provided' },
      ]);

      const response = await fetch(`${this.baseUrl}/api/v1/users`, {
        method: 'POST',
        headers: {
          'X-N8N-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([userPayload]), // ARRAY FORMAT - This is the key!
      });

      console.log('📥 n8n API response status:', response.status);

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ SUCCESS: Real n8n user created!');
        console.log('🔧 Raw API response:', JSON.stringify(responseData, null, 2));

        // n8n returns { data: [...] } format
        const usersArray = responseData.data || responseData; // Handle both formats
        const userResult = Array.isArray(usersArray) ? usersArray[0] : usersArray;
        if (!userResult || userResult.error) {
          throw new Error(`n8n API returned error: ${userResult?.error || 'Unknown error'}`);
        }

        const createdUser = userResult.user;
        console.log('👤 User ID:', createdUser.id);
        console.log('📧 Email sent:', createdUser.emailSent);
        console.log('👥 Role:', createdUser.role);

        // n8n API doesn't return invitation link - we need to construct it
        // Format: {N8N_API_URL}/signup?inviterId={ADMIN_ID}&inviteeId={NEW_USER_ID}&redirect=/workflow/new
        const inviterId = process.env.N8N_INVITER_ID || '';
        const invitationLink = `${this.baseUrl}/signup?inviterId=${inviterId}&inviteeId=${createdUser.id}&redirect=/workflow/new`;

        console.log('🔗 Constructed Invitation URL:', invitationLink);

        return {
          id: createdUser.id,
          email: createdUser.email,
          firstName: userData.firstName, // Use original data as response might be null
          lastName: userData.lastName, // Use original data as response might be null
          inviteAcceptUrl: invitationLink,
          invitation_link: invitationLink,
        };
      } else {
        const errorText = await response.text();
        console.error('❌ n8n API call failed:', response.status, response.statusText);
        console.error('❌ Error response:', errorText);
        throw new Error(`n8n API call failed: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      console.error('❌ CRITICAL ERROR in production n8n API call:', error);
      console.error('❌ This means real n8n invitations are NOT being created!');

      // In production, we should not fall back to mock users
      // Instead, we should fail fast so the issue is noticed immediately
      throw new Error(
        `Production n8n API call failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async createProject(projectData: { name: string; type?: string }): Promise<N8nProject> {
    console.warn('N8nClient.createProject not implemented');
    throw new Error('N8nClient.createProject not implemented');
  }

  async addUserToProject(userId: string, projectId: string): Promise<void> {
    console.warn('N8nClient.addUserToProject not implemented');
    throw new Error('N8nClient.addUserToProject not implemented');
  }

  async createWorkflowInProject(projectId: string, workflowData: any): Promise<N8nWorkflow> {
    console.warn('N8nClient.createWorkflowInProject not implemented');
    throw new Error('N8nClient.createWorkflowInProject not implemented');
  }

  async listProjects(): Promise<N8nProject[]> {
    console.warn('N8nClient.listProjects not implemented');
    return [];
  }

  async getProjectWorkflows(projectId: string): Promise<N8nWorkflow[]> {
    console.warn('N8nClient.getProjectWorkflows not implemented');
    return [];
  }

  async healthCheck(): Promise<boolean> {
    console.warn('N8nClient.healthCheck not implemented');
    return true; // Return true for mock mode
  }
}
