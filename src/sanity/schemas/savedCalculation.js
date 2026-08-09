export default {
  name: 'savedCalculation',
  title: 'Saved Calculation',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Calculation Name',
      type: 'string',
    },
    {
      name: 'calculatorType',
      title: 'Calculator Type',
      type: 'string',
    },
    {
      name: 'inputs',
      title: 'Inputs (JSON)',
      type: 'text',
    },
    {
      name: 'results',
      title: 'Results (JSON)',
      type: 'text',
    },
    {
      name: 'createdAt',
      title: 'Created At',
      type: 'datetime',
    },
  ],
};
