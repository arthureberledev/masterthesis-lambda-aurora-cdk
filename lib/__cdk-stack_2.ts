import * as cdk from "aws-cdk-lib";
import { Aspects, CfnOutput } from "aws-cdk-lib";
import {
  Peer,
  Port,
  InstanceType,
  SecurityGroup,
  SubnetType,
  Vpc,
} from "aws-cdk-lib/aws-ec2";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as nodejslambda from "aws-cdk-lib/aws-lambda-nodejs";
import * as rds from "aws-cdk-lib/aws-rds";
import { CfnDBCluster } from "aws-cdk-lib/aws-rds";
import { Construct } from "constructs";
import * as path from "path";

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a vpc
    const vpc = new Vpc(this, "VPC", {
      cidr: "10.0.0.0/16",
      subnetConfiguration: [{ name: "egress", subnetType: SubnetType.PUBLIC }], // only one subnet is needed
      natGateways: 0, // disable NAT gateways
    });

    // Create a security group for aurora db
    const dbSecurityGroup = new SecurityGroup(this, "DbSecurityGroup", {
      vpc: vpc, // use the vpc created above
      allowAllOutbound: true, // allow outbound traffic to anywhere
    });

    // Allow inbound traffic from anywhere to the db
    dbSecurityGroup.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(3306), // allow inbound traffic on port 3306 (default mysql port)
      "allow inbound traffic from anywhere to the db on port 3306"
    );

    // Create a db cluster
    const dbCluster = new rds.DatabaseCluster(this, "DbCluster", {
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_3_04_0,
      }),
      instances: 1,
      instanceProps: {
        vpc: vpc,
        instanceType: new InstanceType("serverless"),
        autoMinorVersionUpgrade: true,
        publiclyAccessible: true,
        securityGroups: [dbSecurityGroup],
        vpcSubnets: vpc.selectSubnets({
          subnetType: SubnetType.PUBLIC, // use the public subnet created above for the db
        }),
      },
      // writer: rds.ClusterInstance.provisioned("writer"),
      // readers: [
      //   rds.ClusterInstance.serverlessV2("reader", {
      //     scaleWithWriter: true,
      //   }),
      // ],
      // vpc,
      // securityGroups: [dbSecurityGroup],
      // vpcSubnets: vpc.selectSubnets({
      //   subnetType: SubnetType.PUBLIC,
      // }),
      port: 3306,
    });

    // Add capacity to the db cluster to enable scaling
    Aspects.of(dbCluster).add({
      visit(node) {
        if (node instanceof CfnDBCluster) {
          node.serverlessV2ScalingConfiguration = {
            minCapacity: 0.5, // min capacity is 0.5 vCPU
            maxCapacity: 1, // max capacity is 1 vCPU (default)
          };
        }
      },
    });

    // Create layer to hold the shared database configuration code
    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      code: lambda.Code.fromAsset(
        path.resolve(__dirname, "..", "lambda", "shared")
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
    });

    // Define lambda functions
    const userFunctionsPath = path.resolve(__dirname, "..", "lambda", "users");

    // const getUsersFunction = new lambda.Function(this, "GetUsersLambda", {
    //   runtime: lambda.Runtime.NODEJS_18_X,
    //   code: lambda.Code.fromAsset(userFunctionsPath),
    //   handler: "get-users.handler",
    //   environment: {
    //     // Pass the secret arn to the lambda functions
    //     databaseSecretArn: dbCluster.secret?.secretArn ?? "",
    //   },
    // });
    const getUsersFunction = new nodejslambda.NodejsFunction(
      this,
      "GetUsersLambda",
      {
        entry: "./lambda/users/get-users.ts",
        handler: "handler",
        environment: {
          // Pass the secret arn to the lambda functions
          databaseSecretArn: dbCluster.secret?.secretArn ?? "",
        },
      }
    );

    const getUserByIdFunction = new lambda.Function(this, "GetUserByIdLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(userFunctionsPath),
      handler: "get-user-by-id.handler",
      layers: [sharedLayer],
      environment: {
        databaseSecretArn: dbCluster.secret?.secretArn ?? "",
      },
    });

    const createUserFunction = new lambda.Function(this, "CreateUserLambda", {
      runtime: lambda.Runtime.NODEJS_18_X,
      code: lambda.Code.fromAsset(userFunctionsPath),
      handler: "create-user.handler",
      layers: [sharedLayer],
      environment: {
        databaseSecretArn: dbCluster.secret?.secretArn ?? "",
      },
    });

    const deleteUserByIdFunction = new lambda.Function(
      this,
      "DeleteUserByIdLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        code: lambda.Code.fromAsset(userFunctionsPath),
        handler: "delete-user-by-id.handler",
        layers: [sharedLayer],
        environment: {
          databaseSecretArn: dbCluster.secret?.secretArn ?? "",
        },
      }
    );

    const updateUserByIdFunction = new lambda.Function(
      this,
      "UpdateUserByIdLambda",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        code: lambda.Code.fromAsset(userFunctionsPath),
        handler: "update-user-by-id.handler",
        layers: [sharedLayer],
        environment: {
          databaseSecretArn: dbCluster.secret?.secretArn ?? "",
        },
      }
    );

    // allow the lambda function to access credentials stored in AWS Secrets Manager
    // the lambda function will be able to access the credentials for the default database in the db cluster
    dbCluster.secret?.grantRead(getUsersFunction);

    // Define API Gateway
    const api = new apigateway.RestApi(this, "UserRestApi", {
      restApiName: "UserApi",
      description: "Api for managing users",
    });

    // Define API integrations
    const getUsersIntegration = new apigateway.LambdaIntegration(
      getUsersFunction
    );
    const getUserByIdIntegration = new apigateway.LambdaIntegration(
      getUserByIdFunction
    );
    const createUserIntegration = new apigateway.LambdaIntegration(
      createUserFunction
    );
    const deleteUserByIdIntegration = new apigateway.LambdaIntegration(
      deleteUserByIdFunction
    );
    const updateUserByIdIntegration = new apigateway.LambdaIntegration(
      updateUserByIdFunction
    );

    // Define Api resources and methods
    const usersResource = api.root.addResource("users");
    usersResource.addMethod("GET", getUsersIntegration); // GET /users
    usersResource.addMethod("POST", createUserIntegration); // POST /users

    const userIdResource = usersResource.addResource("{id}");
    userIdResource.addMethod("GET", getUserByIdIntegration); // GET /users/{id}
    userIdResource.addMethod("DELETE", deleteUserByIdIntegration); // DELETE /users/{id}
    userIdResource.addMethod("PUT", updateUserByIdIntegration); // PUT /users/{id}

    // create a cfn output for the api url
    new CfnOutput(this, "ApiUrl", { value: api.url });
  }
}
