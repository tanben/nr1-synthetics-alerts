import React from 'react';
import PropTypes from "prop-types";
import { Icon, Toast,HeadingText,Spinner,Tooltip,Link, Grid, GridItem, TextField, Table, TableHeader,TableHeaderCell,TableRowCell, TableRow } from 'nr1';
import * as CommonUtils from './commonUtils';
import PromisePool from 'es6-promise-pool';

export default class SyntheticAlertConditionsNerdlet extends React.Component {
    static propTypes = {
        nerdletState: PropTypes.object.isRequired,
        accountAPIKeys: PropTypes.object
      };
    constructor(props) {
        super(props);

        this.state = {
            percentComplete:0,
            conditions:[],
            policies:[],
            loading:true,
            hasError:false,
            errorMessage:''
        };
        this.showError = this.showError.bind(this);
        this.showSuccess = this.showSuccess.bind(this);
        this.showConditionsErrors= this.showConditionsErrors.bind(this);
        this.getApiKey = this.getApiKey.bind(this);
        this.getConditions = this.getConditions.bind(this);
        this.getPoliciesAndConditions = this.getPoliciesAndConditions.bind(this);
    }

    showError(error){
        if (!error && error.message.length===0){
            console.log(`getPoliciesAndConditions.showError() no error found`);
            return {hasError:false, errorMessage:null};
        }

        console.log(`getPoliciesAndConditions.showError() has error. ${error.message}`);
        Toast.showToast({
            title: 'Error',
            sticky: true,
            description: error.message,
            type: Toast.TYPE.CRITICAL
        });
        return {errorMessage:error.message, hasError: true};
    }
    showSuccess (message){
        Toast.showToast({
            title: 'Success',
            description: message,
            type: Toast.TYPE.NORMAL
        });
        return {errorMessage: null, hasError: false};
    }

    showConditionsErrors(errors){
        if (!errors || errors.length ===0){
            return;
        }

        errors.forEach( error => {
            this.showError(error);
        })

        Toast.showToast({
            title: 'Warning',
            sticky:true,
            description:`There were ${errors.length} error(s). The list maybe incomplete please try again later.`,
            type: Toast.TYPE.CRITICAL
        });
    }

    async getPoliciesAndConditions(apiKey, accountId, monitor){


        const  policiesRet = await CommonUtils.getPolicies(monitor.account.id);

        if (policiesRet.error ){
            return {policies:[], conditions:[], ...this.showError(policiesRet.error)};
        }

        let {policies} = policiesRet ;
        if (!policies || policies.length == 0){
            return {policies:[], conditions:[], hasError:false, errorMessage:null};
        }

        let monitorIdRet = await CommonUtils.getMonitorId(monitor.name, monitor.account.id);
        if ( !monitorIdRet.monitorId || monitorIdRet.error){
            let errorMessage= (monitorIdRet.error)?  monitorIdRet.error.message: 'No Monitor ID found! If this monitor has run within the last 13 months try refreshing the page';
            this.showError(new Error("No Monitor Id Found."));
            return {policies:[], conditions:[], errorMessage, hasError:true};
        }

        monitor.id = monitorIdRet.monitorId;
        monitor.region = monitorIdRet.region;
        this.showSuccess(`Loaded ${policies.length} Policies. Processing conditions please wait.`);

        let results = await this.getConditions(apiKey, accountId, monitor,  policies) ;
        const conditions = results.conditions.filter( condition=>(condition && condition.length >0)).reduce( (acc,curr)=>(acc.concat(curr)) , []);

        this.showSuccess(`Loaded ${conditions.length}  Condition(s)`);
        this.showConditionsErrors(results.errors|| []);

        return {policies, conditions, hasError:false, errorMessage:null};
    }

    async getConditions(apiKey, accountId, monitor,  policies){
        const maxThreads=5;
        const errors=[];

        const progressTracker = (function( that, max){
            return{
                value:0,
                max,
                update: function(){
                    const percentComplete  =  Math.round((++this.value) / this.max * 100);
                    that.setState({percentComplete });
                    return this.value;
                },
                get:function(){return this.value}
            }
        })(this, policies.length *2) ; // single + multilocation condition checks

        const _SynthConditionGenerator =   function* (lparams, lerrors){
            for(let policy of policies){
                lparams.policy=policy;
                yield CommonUtils.getSynthConditions(lparams );
                yield CommonUtils.getMultiLocationConditions(lparams);
            }
        }


        let conditions = await Promise.all([
            CommonUtils.getNrqlNameConditions(accountId, monitor),
            CommonUtils.getNrqlIdConditions(accountId, monitor),
            CommonUtils.getNrqlFacetNameConditions(accountId, monitor),
            CommonUtils.getNrqlFacetIdConditions(accountId, monitor)
        ].map(p=>p.catch(error=>{
            errors.push(error);
        })));

        const pool = new PromisePool(_SynthConditionGenerator({apiKey, accountId, monitor}, errors), maxThreads);
        pool.addEventListener('fulfilled', event => {
            progressTracker.update();
            if (event.data.result.error){
                errors.push(event.data.result.error);
            }else{
                conditions.push (event.data.result.conditions);
            }

          });
        pool.addEventListener('rejected', function (event) {
            progressTracker.update();
            console.log(`unhandler error in PromisePool() ${JSON.stringify(event.data)}`);
            errors.push(event.data.error);
        })

        await pool.start();
        return {conditions, errors} ;

    }

    getApiKey(accountId){
        if (!this.props.accountAPIKeys || Object.keys(this.props.accountAPIKeys).length ==0){
            return null;
        }

        const account =this.props.accountAPIKeys.accounts.filter( acct=> acct.id === accountId);
        return (account && account.length >0)? account[0].value : null;
    }

    async componentDidMount(){
        try{
            let guid = this.props.nerdletState.entityGuid;
            if (!guid){
                return;
            }

            const monitor = await CommonUtils.getMonitorName(guid);
            if (!monitor){
                let errmsg =`Monitor lookup failed. No matching GUID was found.\nPlease check with your administrator,  missing Monitor GUID [${guid}]. `;
                this.showError( new Error('No matching monitor found.'));
                this.setState({loading:false,  errorMessage:errmsg, hasError:true});
                return;
            }

            const accountId = monitor.account.id;

            const apiKey= this.getApiKey(accountId);
            if (!apiKey){
                let errmsg =`Missing API Key for account [${accountId}].\nPlease check with your account administrator to configure this nerdlet with the account [${accountId}] API key.`;
                this.showError( new Error('Missing API Key'));
                this.setState({loading:false,  errorMessage: errmsg, hasError:true});
                return;
            }

            let {policies, conditions, hasError, errorMessage} = await this.getPoliciesAndConditions(apiKey, accountId, monitor);
            this.setState({conditions, policies, loading:false, hasError, errorMessage});
        }catch (error){
            console.log(`componentDidMount(): Unhandled error =${JSON.stringify(error)}`);
            this.showError( error);
        }

    }

    render() {

        if (this.state.loading){
            return  (this.state.percentComplete==0)?<DisplayLoading /> : <DisplayLoadingConditions percentComplete={this.state.percentComplete}/>;
        }

        if (this.state.hasError){
            return (<DisplayMessage message={this.state.errorMessage}/>);
        }

        if (!this.state.conditions || this.state.conditions.length == 0){
            const message='No Conditions targettng this monitor';
            return (<DisplayMessage message={message}/>);
        }else{
            return (<DisplayConditionsTable conditions={this.state.conditions} />);
        }

    }
}



//Usage: <DisplayAPIKeyForm {...this.state} keyChangeHandler={this.handleAdminKeyChange}  />
const DisplayAPIKeyForm=(props)=>{
    const {showApi, noId, keyChangeHandler, apiKeyUrl} = props;
    if (showApi && noId===false){
        return (
            <GridItem columnSpan={4}>
             <TextField type={TextField.TYPE.PASSWORD} label="REST API Key" placeholder="Copy/Paste REST API..." onChange={(event) => keyChangeHandler(event.target.value)}/>
             <Link to={apiKeyUrl}>Find your REST API Key</Link>
        </GridItem>
        );
    }

    return null;
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


const DisplayLoading = (props)=>{
    return(
        <div>
            <HeadingText type={HeadingText.TYPE.HEADING_4}>Loading Alert Policies and Conditions</HeadingText><Spinner type={Spinner.TYPE.DOT}  inline/>
        </div>
    );
}

const DisplayLoadingConditions=(props)=>{
    return(
        <div>
            <HeadingText type={HeadingText.TYPE.HEADING_4}>Loading Conditions</HeadingText>
            <Grid spacingType={[Grid.SPACING_TYPE.NONE]}>
            <GridItem columnSpan={6}><ProgressBar bgcolor="#ef6c00" completed={props.percentComplete} /></GridItem>
            </Grid>
        </div>
    );
}

const DisplayConditionsTable = (props)=>{
    const {conditions} = props;

    const nrlqFacetTooltipMsg=`These NRQL Conditions are general conditions that contains: FACET monitorName or FACET monitorId`;
    const nrqlToolTip=()=>(<Tooltip text={nrlqFacetTooltipMsg} placementType={Tooltip.PLACEMENT_TYPE.BOTTOM}><Icon type={Icon.TYPE.INTERFACE__INFO__INFO} /> </Tooltip>);

    return(
        <Grid spacingType={[Grid.SPACING_TYPE.LARGE]}>
           <GridItem columnSpan={12} >
               <Table items={conditions}>
                   <TableHeader>
                       <TableHeaderCell value={({ item }) => item}>
                           Condition
                       </TableHeaderCell>
                       <TableHeaderCell value={({ item }) => item.entities.length}>
                           Entities
                       </TableHeaderCell>
                       <TableHeaderCell value={({ item }) => item.type}>
                           Type
                       </TableHeaderCell>
                       <TableHeaderCell value={({ item }) => item.enabled}>
                           Enabled
                       </TableHeaderCell>

                   </TableHeader>
                   {({ item }) =>{
                        return (
                        <TableRow>
                            <TableRowCell>{item.type == "NRQL Facet" ? nrqlToolTip() : null} <Link to={item.permalink}>{item.name} </Link></TableRowCell>
                            <TableRowCell><Tooltip text={item.entities.join('\n')} placementType={Tooltip.PLACEMENT_TYPE.BOTTOM}> {item.entities.length > 0 ? item.entities.length : "-"}</Tooltip></TableRowCell>
                            <TableRowCell>{item.type}</TableRowCell>
                            <TableRowCell>{item.enabled ? <Icon type={Icon.TYPE.INTERFACE__SIGN__CHECKMARK} /> : <Icon type={Icon.TYPE.INTERFACE__SIGN__TIMES} />}</TableRowCell>
                        </TableRow>
                   )}}
               </Table>
           </GridItem>

        </Grid>
    )
}


const ProgressBar = (props) => {
    const { bgcolor, completed } = props;

    const outerContainerStyle={
        paddingLeft: '10px'
    };
    const containerStyles = {
      height: 20,
      width: '95%',
      backgroundColor: "#e0e0de",
      borderRadius: 50,
    }

    const fillerStyles = {
      height: '100%',
      width: `${completed}%`,
      backgroundColor: bgcolor,
      borderRadius: 'inherit',
      textAlign: 'right'
    }

    const labelStyles = {
      padding: 5,
      color: 'white',
      fontWeight: 'bold'
    }

    return (
      <div style={outerContainerStyle}>
        <div style={containerStyles}>
            <div style={fillerStyles}>
            <span style={labelStyles}>{`${completed}%`}</span>
            </div>
        </div>
      </div>

    );
};

