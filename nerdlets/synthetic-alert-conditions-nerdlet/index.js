import React from 'react';
import PropTypes from "prop-types";
import SyntheticAlertConditionsNerdlet from './conditions'
import { PlatformStateContext,nerdlet,NerdletStateContext,Toast,HeadingText,Spinner,Tooltip,NerdGraphQuery,AccountPicker,Link,UserQuery,Stack, StackItem,Grid, GridItem, TextField, Button, Table, TableHeader,TableHeaderCell,TableRowCell, TableRow } from 'nr1';
// https://docs.newrelic.com/docs/new-relic-programmable-platform-introduction

export default class UsageDetails extends React.Component {
    render() {
      return (
        <PlatformStateContext.Consumer>
          {platformUrlState => (
            <NerdletStateContext.Consumer>
              {nerdletState => (
                <SyntheticAlertConditionsNerdlet
                  nerdletState={nerdletState}
                />
              )}
            </NerdletStateContext.Consumer>
          )}
        </PlatformStateContext.Consumer>
      );
    }
  }