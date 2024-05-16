import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Cluster, ContainerImage, FargateTaskDefinition, Protocol } from 'aws-cdk-lib/aws-ecs';
import { Vpc } from 'aws-cdk-lib/aws-ec2';
import { ApplicationLoadBalancedFargateService } from 'aws-cdk-lib/aws-ecs-patterns';

export class CipherstashProxyAwsCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create a VPC
    const vpc = new Vpc(this, 'MyVpc', { maxAzs: 2 });

    // Create an ECS cluster
    const cluster = new Cluster(this, 'MyCluster', { vpc });

    // Define the Task Definition with Container
    const taskDefinition = new FargateTaskDefinition(this, 'TaskDef');
    const container = taskDefinition.addContainer('cipherstash-proxy', {
      image: ContainerImage.fromRegistry('cipherstash/cipherstash-proxy:latest'),
      environment: {
        CS_USERNAME: process.env.CS_USERNAME || 'postgres',
        CS_PASSWORD: process.env.CS_PASSWORD || 'password',
        CS_WORKSPACE_ID: process.env.CS_WORKSPACE_ID || 'workspace',
        CS_CLIENT_ACCESS_KEY: process.env.CS_CLIENT_ACCESS_KEY || '1234567890',
        CS_DATABASE__NAME: process.env.CS_DATABASE__NAME || 'database',
        CS_DATABASE__HOST: process.env.CS_DATABASE__HOST || 'localhost',
        CS_DATABASE__PORT: process.env.CS_DATABASE__PORT || '5432',
      },
    });

    // Map the port
    container.addPortMappings({
      containerPort: 6432,
      hostPort: 6432,
      protocol: Protocol.TCP,
    });

    // Create an ECS Service using a Fargate service and make it public
    new ApplicationLoadBalancedFargateService(this, 'MyFargateService', {
      cluster,
      taskDefinition,
      publicLoadBalancer: true,
      listenerPort: 6432,
    });
  }
}