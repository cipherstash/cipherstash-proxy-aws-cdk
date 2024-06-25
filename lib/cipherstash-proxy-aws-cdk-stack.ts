import { Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { Vpc, SecurityGroup, Port, Peer } from 'aws-cdk-lib/aws-ec2';
import { NetworkLoadBalancer, Protocol } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { 
  Cluster, 
  ContainerImage, 
  FargateTaskDefinition, 
  LogDriver, 
  FargateService, 
  Protocol as ECSProtocol 
} from 'aws-cdk-lib/aws-ecs';

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
        CS_DATABASE__USERNAME: process.env.CS_DATABASE__USERNAME || 'username',
        CS_DATABASE__PASSWORD: process.env.CS_DATABASE__PASSWORD || 'password',
        CS_DATABASE__NAME: process.env.CS_DATABASE__NAME || 'name',
        CS_DATABASE__HOST: process.env.CS_DATABASE__HOST || 'host',
        CS_DATABASE__PORT: process.env.CS_DATABASE__PORT || 'port',
      },
      logging: LogDriver.awsLogs({
        streamPrefix: "cipherstash-proxy",
        logRetention: 30 // days
      }),
    });

    // Map the port
    container.addPortMappings({
      containerPort: 6432,
      protocol: ECSProtocol.TCP,
    });

    // Define a Security Group for the ECS tasks
    const ecsSecurityGroup = new SecurityGroup(this, 'ECSSecurityGroup', {
      vpc,
      description: 'Allow TCP access on port 6432 from anywhere for ECS tasks',
      allowAllOutbound: true // Typically set to true unless you have specific needs
    });

    // Allow incoming TCP traffic on port 6432 from anywhere
    // This is a security risk and should be locked down to specific IPs or services
    ecsSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(6432), 'Allow TCP traffic on port 6432 from anywhere');

    // Create a Network Load Balancer
    const nlb = new NetworkLoadBalancer(this, 'MyNLB', {
      vpc,
      internetFacing: true
    });

    // Create an ECS Service using Fargate without an ALB
    const fargateService = new FargateService(this, 'MyFargateService', {
      cluster,
      taskDefinition,
      securityGroups: [ecsSecurityGroup],
    });

    // Add a listener to the NLB
    const listener = nlb.addListener('Listener', {
      port: 6432,
      protocol: Protocol.TCP,
    });

    // Add the ECS service as a target
    listener.addTargets('EcsService', {
      port: 6432,
      targets: [fargateService.loadBalancerTarget({
        containerName: 'cipherstash-proxy',
        containerPort: 6432
      })],
    });
  }
}
