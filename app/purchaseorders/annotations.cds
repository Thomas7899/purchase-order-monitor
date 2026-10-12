using MonitorService as service from '../../srv/monitor-service';

annotate service.PurchaseOrderItems with {
  supplier         @Common.Text: supplier.name      @Common.TextArrangement: #TextFirst;
  status           @Common.Text: status.name        @Common.TextArrangement: #TextOnly
                   @Common.ValueListWithFixedValues;
  orderedQuantity  @Measures.Unit: unit;
  receivedQuantity @Measures.Unit: unit;
  confirmedQuantity @Measures.Unit: unit;
  netPrice         @Measures.ISOCurrency: currency;
  openValue        @Measures.ISOCurrency: currency;
  unit             @UI.Hidden;
  currency         @UI.Hidden;
}

annotate service.PurchaseOrderItems with @(
  UI.HeaderInfo         : {
    TypeName      : '{i18n>ScheduleLine}',
    TypeNamePlural: '{i18n>ScheduleLines}',
    Title         : {Value: description},
    Description   : {Value: purchaseOrder}
  },
  UI.SelectionFields    : [
    status_code,
    supplier_ID,
    purchasingGroup,
    plant,
    requestedDate
  ],
  UI.PresentationVariant: {
    SortOrder     : [{
      Property  : delayDays,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.LineItem           : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'MonitorService.syncFromS4',
      Label : '{i18n>SyncFromS4}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'MonitorService.sendReminder',
      Label : '{i18n>SendReminder}'
    },
    {Value: purchaseOrder},
    {Value: purchaseOrderItem},
    {Value: supplier_ID},
    {Value: description},
    {
      Value                    : status_code,
      Criticality              : status.criticality,
      CriticalityRepresentation: #WithIcon
    },
    {
      Value      : delayDays,
      Criticality: status.criticality
    },
    {Value: requestedDate},
    {Value: confirmedDate},
    {Value: dunningLevel},
    {Value: openValue}
  ],

  UI.HeaderFacets       : [
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#status'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#delay'
    },
    {
      $Type : 'UI.ReferenceFacet',
      Target: '@UI.DataPoint#openValue'
    }
  ],
  UI.DataPoint #status  : {
    Value      : status_code,
    Title      : '{i18n>Status}',
    Criticality: status.criticality
  },
  UI.DataPoint #delay   : {
    Value      : delayDays,
    Title      : '{i18n>DelayDays}',
    Criticality: status.criticality
  },
  UI.DataPoint #openValue: {
    Value: openValue,
    Title: '{i18n>OpenValue}'
  },
  UI.Identification     : [
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'MonitorService.recordConfirmation',
      Label : '{i18n>RecordConfirmation}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'MonitorService.sendReminder',
      Label : '{i18n>SendReminder}'
    },
    {
      $Type : 'UI.DataFieldForAction',
      Action: 'MonitorService.escalate',
      Label : '{i18n>Escalate}'
    }
  ],
  UI.Facets             : [
    {
      $Type : 'UI.CollectionFacet',
      ID    : 'General',
      Label : '{i18n>Order}',
      Facets: [
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>Order}',
          Target: '@UI.FieldGroup#Order'
        },
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>DeliveryAndQuantities}',
          Target: '@UI.FieldGroup#Delivery'
        },
        {
          $Type : 'UI.ReferenceFacet',
          Label : '{i18n>Monitoring}',
          Target: '@UI.FieldGroup#Monitoring'
        }
      ]
    },
    {
      $Type : 'UI.ReferenceFacet',
      Label : '{i18n>History}',
      Target: 'activities/@UI.LineItem'
    }
  ],
  UI.FieldGroup #Order  : {Data: [
    {Value: purchaseOrder},
    {Value: purchaseOrderItem},
    {Value: scheduleLine},
    {Value: supplier_ID},
    {Value: material},
    {Value: plant},
    {Value: purchasingGroup},
    {Value: orderDate},
    {Value: netPrice},
    {Value: priceUnit}
  ]},
  UI.FieldGroup #Delivery: {Data: [
    {Value: requestedDate},
    {Value: confirmedDate},
    {Value: orderedQuantity},
    {Value: confirmedQuantity},
    {Value: receivedQuantity},
    {Value: openValue}
  ]},
  UI.FieldGroup #Monitoring: {Data: [
    {
      Value      : status_code,
      Criticality: status.criticality
    },
    {Value: delayDays},
    {Value: dunningLevel},
    {Value: lastReminderAt},
    {Value: escalated}
  ]}
);

// Nach einer Aktion den Verlauf neu laden
annotate service.PurchaseOrderItems actions {
  recordConfirmation @Common.SideEffects: {TargetEntities: ['in/activities']}
                     (channel @Common.ValueListWithFixedValues @Common.ValueList: {
                       CollectionPath: 'Channels',
                       Parameters    : [{
                         $Type            : 'Common.ValueListParameterInOut',
                         LocalDataProperty: channel,
                         ValueListProperty: 'code'
                       }, {
                         $Type            : 'Common.ValueListParameterDisplayOnly',
                         ValueListProperty: 'name'
                       }]
                     });
  sendReminder       @Common.SideEffects: {TargetEntities: ['in/activities']};
  escalate           @Common.SideEffects: {TargetEntities: ['in/activities']};
}

annotate service.Activities with {
  type    @Common.Text: type.name    @Common.TextArrangement: #TextOnly;
  channel @Common.Text: channel.name @Common.TextArrangement: #TextOnly;
}

annotate service.Activities with @(
  UI.PresentationVariant: {
    SortOrder     : [{
      Property  : createdAt,
      Descending: true
    }],
    Visualizations: ['@UI.LineItem']
  },
  UI.LineItem           : [
    {
      Value: createdAt,
      Label: '{i18n>CreatedAt}'
    },
    {
      Value: createdBy,
      Label: '{i18n>CreatedBy}'
    },
    {Value: type_code},
    {Value: channel_code},
    {Value: confirmedDate},
    {Value: confirmedQuantity},
    {Value: dunningLevel},
    {Value: text}
  ]
);
