import React from 'react';
import SyntheticAlertConditionsNerdlet from './conditions'
import Configurator from './components/Configurator';
import * as CommonUtils from './commonUtils';
import {Toast, CardHeader} from 'nr1';


import { PlatformStateContext,NerdletStateContext, Link, Card, CardBody} from 'nr1';
// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

export default class UsageDetails extends React.Component {


    constructor(props){
      super(props);

      this.nerdStoreOptions={
        accountId: -1,  // set this to the account master
        collection: "SynthCollection_AccountConfig",
        documentId: "SynthDocument_AccountConfig"
      }

      this.dataChangeHandler = this.dataChangeHandler.bind(this);

      // customize Configurator options
      this.configuratorOptions = ConfiguratorOptions({
        accountId: this.nerdStoreOptions.accountId,
        collection: this.nerdStoreOptions.collectionId,
        documentId: this.nerdStoreOptions.documentId,
        dataChangeHandler: this.dataChangeHandler,
        enableToolsPanel: false
      });

      this.accountKeys=[];
      this.accounts=[];

      this.getNewKeys = this.getNewKeys.bind(this);
      this.validateKeys = this.validateKeys.bind(this);

      if (this.nerdStoreOptions.accountId === -1){
        Toast.showToast({
          title: 'CRITICAL BUILD ERROR',
          sticky:true,
          description: "Nerdlet was compiled without a designated account for storage.",
          type: Toast.TYPE.CRITICAL
        });
      }
    }

    getNewKeys(data){
      const accounts = data.accounts;
      const accountKeys= [...accounts.reduce( (acc, curr)=>(acc.concat(curr.value)), [])];
      const prevAcctKeys = this.accountKeys;

      return  {newKeys:accountKeys.filter( key=>(!prevAcctKeys.includes(key))), accountKeys, accounts };
    }


    async validateKeys(apiKeys){
      const promises=[];
      for (let apiKey of apiKeys){
        promises.push(  CommonUtils.validateApiKey( apiKey ) );
      }
      const invalidKeys=[];
      const results = await Promise.all(promises.map(p=>p.catch(error=>{
        // collect all keys that failed
        const {message, apiKey} = error;
        // console.log(` message =${message} error=${JSON.stringify(error)}`);
        invalidKeys.push(apiKey);
      })));

      if (invalidKeys.length >0){
        return Promise.reject([...invalidKeys]);
      }

      return Promise.resolve(results);
    }


    async dataChangeHandler(data){
      if (typeof data ==='undefined' || !data){
        return;
      }

      const {newKeys, accountKeys, accounts} = this.getNewKeys(data);
      this.accountKeys = accountKeys;
      this.accounts= accounts;

      let accountsWithInvalidKeys = [];
      await this.validateKeys(newKeys).catch( invalidKeys =>{

        // match account with invalid key
        invalidKeys.forEach( key => {
          accountsWithInvalidKeys = accountsWithInvalidKeys.concat( this.accounts.filter( account => account.value === key));
        });
      });


      for(let acct of accountsWithInvalidKeys){
        const errorMessage=`Invalid API Keys or Account Id for account: ${acct.name} ( ${acct.id} ). Please check your account ID or API Key`;
        Toast.showToast({
          title: 'Error',
          sticky:true,
          description: errorMessage,
          type: Toast.TYPE.CRITICAL
        });
      }



    }


    render() {
      const configurator = this.configuratorOptions;

      return (
        <PlatformStateContext.Consumer>
        {platformUrlState => {
          return <NerdletStateContext.Consumer>
            {nerdletState => {
               return  (!nerdletState.entityGuid)?  <CatalogLauncher {...configurator} /> :  <EntityLauncher nerdletState={nerdletState} configurator={configurator}/>;
            }}
          </NerdletStateContext.Consumer>
        }}
      </PlatformStateContext.Consumer>
      );
  }
}


const DisplayMessage = (props)=>{
  return (

      <Grid spacingType={[Grid.SPACING_TYPE.LARGE]}>
        <GridItem columnSpan={12}>
           <pre>{props.message}</pre>
        </GridItem>
      </Grid>

  );
}
const CatalogLauncher=(props) =>{

  const bodyStyle={
    fontSize:'14px'
  };
  return(
    <Card>
      <CardHeader title="Setup:"></CardHeader>
      <CardBody style={bodyStyle}>1. Click the configuration button to add, update or remove an account configurations.
        <Configurator  {...props} />
      </CardBody>

      <CardBody style={bodyStyle}>2. Navigate to Synthetics Overview Page and select a monitor </CardBody>
      <CardBody style={bodyStyle}>3. From the Left Navigation , select More View, select Synthetics Condition Search link to view the conditions associated with the monitor. </CardBody>
    </Card>

  );
}


const EntityLauncher =  (props)=>{
  const {nerdletState, configurator} = props;
  return( <Configurator  {...configurator}  >
         <SyntheticAlertConditionsNerdlet  nerdletState={nerdletState}/>
        </Configurator>);
 }

const ConfiguratorOptions=({accountId, collection, documentId,  schema, uiSchema, dataChangeHandler, enableToolsPanel})=>{
  return{
    accountId,
    enableToolsPanel,

    schema: schema|| ConfiguratorSchema.schema,
    uiSchema: uiSchema || ConfiguratorSchema.uiSchema,
    dataChangeHandler: dataChangeHandler || function(){return},
    storageCollectionId: collection || "AccountConfig",
    documentId: documentId || "accountConfig",
    buttonTitle: "Configuration",
    modalTitle: "Account Editor",
    modalHelp: "Use the form below to configure accounts to report violations on."
  }// return;
}

const ConfiguratorSchema={
    schema: {
      type: 'object',
      properties: {
        accounts: {
          type: 'array',
          title: 'Accounts',
          items: {
            required: ['name', 'value', 'id'],
            properties: {
              name: {
                type: 'string',
                title: 'Account Name'
              },
              value: {
                type: 'string',
                title: 'API Key'
              },
              id: {
                type: 'number',
                title: 'Account ID'
              }
            }
          }
        }
      }
    },
    uiSchema : {
      accounts: {
        items: {
          value: {
            'ui:widget': 'password'
          }
        }
      }
    }
};
