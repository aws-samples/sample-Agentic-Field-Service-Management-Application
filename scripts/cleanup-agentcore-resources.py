#!/usr/bin/env python3
"""
Cleanup script for AgentCore Gateway and agents deployed outside CloudFormation
"""

import boto3
import json
import time

def cleanup_agentcore_agents():
    """Delete all FSM AgentCore agents"""
    print("🗑️ Cleaning up AgentCore agents...")
    
    try:
        client = boto3.client('bedrock-agentcore-control')
        
        # List all agent runtimes
        response = client.list_agent_runtimes()
        
        fsm_agents = [
            runtime for runtime in response.get('agentRuntimes', [])
            if runtime.get('name', '').startswith('fsm_')
        ]
        
        if not fsm_agents:
            print("✅ No FSM agents found to delete")
            return
        
        for agent in fsm_agents:
            agent_name = agent.get('name', 'Unknown')
            agent_arn = agent.get('agentRuntimeArn', '')
            
            try:
                print(f"🗑️ Deleting agent: {agent_name}")
                client.delete_agent_runtime(agentRuntimeArn=agent_arn)
                print(f"✅ Deleted agent: {agent_name}")
            except Exception as e:
                print(f"❌ Failed to delete agent {agent_name}: {e}")
                
    except Exception as e:
        print(f"❌ Error listing agents: {e}")

def cleanup_gateway_targets():
    """Delete Gateway targets"""
    print("\n🗑️ Cleaning up Gateway targets...")
    
    try:
        client = boto3.client('bedrock-agentcore-control')
        
        # Find FSM Gateway
        gateways = client.list_gateways()
        fsm_gateway = None
        
        for gateway in gateways.get('items', []):
            if gateway['name'] == 'FSM-Gateway':
                fsm_gateway = gateway
                break
        
        if not fsm_gateway:
            print("✅ No FSM Gateway found")
            return
            
        gateway_id = fsm_gateway['gatewayId']
        
        # List and delete targets
        targets = client.list_gateway_targets(gatewayIdentifier=gateway_id)
        
        for target in targets.get('gatewayTargets', []):
            target_name = target.get('name', 'Unknown')
            try:
                print(f"🗑️ Deleting target: {target_name}")
                client.delete_gateway_target(
                    gatewayIdentifier=gateway_id,
                    targetIdentifier=target_name
                )
                print(f"✅ Deleted target: {target_name}")
            except Exception as e:
                print(f"❌ Failed to delete target {target_name}: {e}")
                
    except Exception as e:
        print(f"❌ Error cleaning up targets: {e}")

def cleanup_gateway():
    """Delete AgentCore Gateway"""
    print("\n🗑️ Cleaning up AgentCore Gateway...")
    
    try:
        client = boto3.client('bedrock-agentcore-control')
        
        # Find and delete FSM Gateway
        gateways = client.list_gateways()
        
        for gateway in gateways.get('items', []):
            if gateway['name'] == 'FSM-Gateway':
                gateway_id = gateway['gatewayId']
                try:
                    print(f"🗑️ Deleting Gateway: {gateway_id}")
                    client.delete_gateway(gatewayIdentifier=gateway_id)
                    print(f"✅ Deleted Gateway: {gateway_id}")
                except Exception as e:
                    print(f"❌ Failed to delete Gateway: {e}")
                break
        else:
            print("✅ No FSM Gateway found to delete")
            
    except Exception as e:
        print(f"❌ Error deleting Gateway: {e}")

def cleanup_cognito_resources():
    """Delete Cognito resources created for Gateway"""
    print("\n🗑️ Cleaning up Cognito resources...")
    
    try:
        cognito = boto3.client('cognito-idp')
        
        # Find FSM User Pools
        pools = cognito.list_user_pools(MaxResults=50)
        
        for pool in pools['UserPools']:
            if pool['Name'] == 'FSM-AgentCore-Gateway-Pool':
                user_pool_id = pool['Id']
                
                try:
                    # Delete domain first
                    domain_name = f"fsm-gateway-{user_pool_id.lower().replace('_', '-')}"
                    try:
                        print(f"🗑️ Deleting Cognito domain: {domain_name}")
                        cognito.delete_user_pool_domain(Domain=domain_name)
                        print(f"✅ Deleted domain: {domain_name}")
                        time.sleep(5)  # Wait for domain deletion
                    except Exception as e:
                        print(f"⚠️ Domain deletion: {e}")
                    
                    # Delete user pool
                    print(f"🗑️ Deleting User Pool: {user_pool_id}")
                    cognito.delete_user_pool(UserPoolId=user_pool_id)
                    print(f"✅ Deleted User Pool: {user_pool_id}")
                    
                except Exception as e:
                    print(f"❌ Failed to delete User Pool {user_pool_id}: {e}")
                break
        else:
            print("✅ No FSM User Pool found to delete")
            
    except Exception as e:
        print(f"❌ Error cleaning up Cognito: {e}")

def cleanup_iam_roles():
    """Delete IAM roles created for Gateway"""
    print("\n🗑️ Cleaning up IAM roles...")
    
    try:
        iam = boto3.client('iam')
        
        # Delete Gateway IAM role
        role_name = "FSM-AgentCoreGateway-Role"
        try:
            # Detach policies first
            attached_policies = iam.list_attached_role_policies(RoleName=role_name)
            for policy in attached_policies['AttachedPolicies']:
                print(f"🗑️ Detaching policy: {policy['PolicyName']}")
                iam.detach_role_policy(RoleName=role_name, PolicyArn=policy['PolicyArn'])
                
                # Delete custom policies
                if policy['PolicyArn'].startswith('arn:aws:iam::'):
                    try:
                        iam.delete_policy(PolicyArn=policy['PolicyArn'])
                        print(f"✅ Deleted policy: {policy['PolicyName']}")
                    except Exception as e:
                        print(f"⚠️ Policy deletion: {e}")
            
            # Delete role
            print(f"🗑️ Deleting IAM role: {role_name}")
            iam.delete_role(RoleName=role_name)
            print(f"✅ Deleted IAM role: {role_name}")
            
        except iam.exceptions.NoSuchEntityException:
            print("✅ No FSM Gateway IAM role found")
        except Exception as e:
            print(f"❌ Failed to delete IAM role: {e}")
            
    except Exception as e:
        print(f"❌ Error cleaning up IAM: {e}")

def cleanup_config_files():
    """Remove local config files"""
    print("\n🗑️ Cleaning up local config files...")
    
    import os
    
    config_files = [
        'agentcore_gateway_config.json',
        'agentcore_deployment_results.json'
    ]
    
    for config_file in config_files:
        try:
            if os.path.exists(config_file):
                os.remove(config_file)
                print(f"✅ Deleted: {config_file}")
            else:
                print(f"✅ Not found: {config_file}")
        except Exception as e:
            print(f"❌ Failed to delete {config_file}: {e}")

def main():
    """Main cleanup function"""
    print("🧹 Starting AgentCore Resources Cleanup")
    print("=" * 50)
    
    # Cleanup in reverse order of creation
    cleanup_agentcore_agents()
    cleanup_gateway_targets() 
    cleanup_gateway()
    cleanup_cognito_resources()
    cleanup_iam_roles()
    cleanup_config_files()
    
    print("\n" + "=" * 50)
    print("🎉 AgentCore cleanup completed!")
    print("\nNote: AgentCore Runtime execution roles are managed by AWS and will be cleaned up automatically.")

if __name__ == "__main__":
    main()
