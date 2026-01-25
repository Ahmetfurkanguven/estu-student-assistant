export const SPECIALIZATION_GROUPS = [
    {
        id: 'electronics',
        name: '1- Elektronik / Electronics',
        courses: [
            // Güz
            { code: 'EEM4501', name: 'Analog Electronics', isMandatory: true, prerequisite: 'EEM321', term: 'Güz' },
            { code: 'EEM403', name: 'Fundamentals of Opto. and Nanophoto.', isMandatory: true, prerequisite: 'EEM208', term: 'Güz' },
            { code: 'EEM449', name: 'Embedded System Design', isMandatory: false, prerequisite: 'EEM336', term: 'Güz' },
            { code: 'EEM463', name: 'Introduction to Image Processing', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM470', name: 'Microwaves and Antenna', isMandatory: false, prerequisite: 'EEM208', term: 'Güz' },
            { code: 'EEM417', name: 'Engineering Computations', isMandatory: false, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM459', name: 'Research in Electronics I', isMandatory: false, prerequisite: 'EEM321', term: 'Güz' },
            // Bahar
            { code: 'EEM438', name: 'Introduction to AI Processor Design', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM469', name: 'Communication Electronics', isMandatory: false, prerequisite: 'EEM321', term: 'Bahar' },
            { code: 'EEM464', name: 'System-On-Chip (SOC) Design', isMandatory: false, prerequisite: 'EEM334', term: 'Bahar' },
            { code: 'EEM460', name: 'Research in Electronics II', isMandatory: false, prerequisite: 'EEM321', term: 'Bahar' }
        ]
    },
    {
        id: 'power',
        name: '2- Güç Sistemleri / Power Systems',
        courses: [
            // Güz
            { code: 'EEM471', name: 'Electrical Machinery I', isMandatory: true, prerequisite: 'EEM311', term: 'Güz' },
            { code: 'EEM473', name: 'Power Systems Analysis I', isMandatory: true, prerequisite: 'EEM311', term: 'Güz' },
            { code: 'EEM475', name: 'Power Electronics I', isMandatory: false, prerequisite: 'EEM321', term: 'Güz' },
            { code: 'EEM417', name: 'Engineering Computations', isMandatory: false, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM455', name: 'Research in Power Systems I', isMandatory: false, prerequisite: 'EEM311', term: 'Güz' },
            // Bahar
            { code: 'EEM450', name: 'Introduction to System Identification', isMandatory: false, prerequisite: 'EEM301', term: 'Bahar' },
            { code: 'EEM466', name: 'High Voltage Techniques', isMandatory: false, prerequisite: 'EEM471', term: 'Bahar' },
            { code: 'EEM476', name: 'Power Electronics II', isMandatory: false, prerequisite: 'EEM475', term: 'Bahar' },
            { code: 'EEM479', name: 'Electrical Installation Systems', isMandatory: false, prerequisite: 'EEM311', term: 'Bahar' },
            { code: 'EEM483', name: 'Power Systems Analysis II', isMandatory: false, prerequisite: 'EEM473', term: 'Bahar' },
            { code: 'EEM456', name: 'Research in Power Systems II', isMandatory: false, prerequisite: 'EEM311', term: 'Bahar' }
        ]
    },
    {
        id: 'telecom',
        name: '3- Haberleşme / Telecommunications',
        courses: [
            // Güz
            { code: 'EEM409', name: 'Random Signals', isMandatory: true, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM467', name: 'Digital Communications', isMandatory: true, prerequisite: null, term: 'Güz' }, // Tabloda önşart boş
            { code: 'EEM470', name: 'Microwaves and Antenna', isMandatory: false, prerequisite: 'EEM208', term: 'Güz' },
            { code: 'EEM477', name: 'Digital Signal Processing', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM417', name: 'Engineering Computations', isMandatory: false, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM461', name: 'Research in Telecommunications I', isMandatory: false, prerequisite: 'EEM308', term: 'Güz' },
            // Bahar
            { code: 'EEM438', name: 'Introduction to AI Processor Design', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM464', name: 'System-On-Chip (SOC) Design', isMandatory: false, prerequisite: 'EEM334', term: 'Bahar' },
            { code: 'EEM465', name: 'Fundamentals of Data Communications', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM469', name: 'Communication Electronics', isMandatory: false, prerequisite: 'EEM321', term: 'Bahar' },
            { code: 'EEM482', name: 'Fundamentals of Data Networks', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM496', name: 'Communications System Laboratory', isMandatory: false, prerequisite: 'EEM467', term: 'Bahar' },
            { code: 'EEM462', name: 'Research in Telecommunications II', isMandatory: false, prerequisite: 'EEM308', term: 'Bahar' }
        ]
    },
    {
        id: 'control',
        name: '4- Kontrol / Control',
        courses: [
            // Güz
            { code: 'EEM491', name: 'Linear Control Systems', isMandatory: true, prerequisite: 'EEM342', term: 'Güz' },
            { code: 'EEM451', name: 'Industrial Control Systems', isMandatory: false, prerequisite: 'EEM342', term: 'Güz' },
            { code: 'EEM475', name: 'Power Electronics I', isMandatory: false, prerequisite: 'EEM321', term: 'Güz' },
            { code: 'EEM477', name: 'Digital Signal Processing', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM493', name: 'Digital Control Systems', isMandatory: false, prerequisite: 'EEM342', term: 'Güz' },
            { code: 'EEM417', name: 'Engineering Computations', isMandatory: false, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM453', name: 'Research in Control Systems I', isMandatory: false, prerequisite: 'EEM342', term: 'Güz' },
            // Bahar
            { code: 'EEM450', name: 'Introduction to System Identification', isMandatory: false, prerequisite: 'EEM301', term: 'Bahar' },
            { code: 'EEM482', name: 'Fundamentals of Data Networks', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM494', name: 'Control Systems Laboratory', isMandatory: false, prerequisite: 'EEM491', term: 'Bahar' },
            { code: 'EEM454', name: 'Research in Control Systems II', isMandatory: false, prerequisite: 'EEM342', term: 'Bahar' }
        ]
    },
    {
        id: 'digital',
        name: '5- Sayısal Sistemler / Digital Systems',
        courses: [
            // Güz
            { code: 'EEM449', name: 'Embedded System Design', isMandatory: true, prerequisite: 'EEM336', term: 'Güz' },
            { code: 'EEM480', name: 'Algorithms and Complexity', isMandatory: true, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM4503', name: 'Digital Systems Design with VHDL and FPGA', isMandatory: false, prerequisite: 'EEM232', term: 'Güz' },
            { code: 'EEM463', name: 'Introduction to Image Processing', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM477', name: 'Digital Signal Processing', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM417', name: 'Engineering Computations', isMandatory: false, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM447', name: 'Research in Digital Systems I', isMandatory: false, prerequisite: 'EEM336', term: 'Güz' },
            // Bahar
            { code: 'EEM438', name: 'Introduction to AI Processor Design', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM464', name: 'System-On-Chip (SOC) Design', isMandatory: false, prerequisite: 'EEM334', term: 'Bahar' },
            { code: 'EEM482', name: 'Fundamentals of Data Networks', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM486', name: 'Computer Architecture', isMandatory: false, prerequisite: 'EEM232', term: 'Bahar' },
            { code: 'EEM448', name: 'Research in Digital Systems II', isMandatory: false, prerequisite: 'EEM336', term: 'Bahar' }
        ]
    },
    {
        id: 'signal',
        name: '6- Sinyal İşleme / Signal Processing',
        courses: [
            // Güz
            { code: 'EEM409', name: 'Random Signals', isMandatory: true, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM477', name: 'Digital Signal Processing', isMandatory: true, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM463', name: 'Introduction to Image Processing', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            { code: 'EEM467', name: 'Digital Communications', isMandatory: false, prerequisite: null, term: 'Güz' },
            { code: 'EEM491', name: 'Linear Control Systems', isMandatory: false, prerequisite: 'EEM342', term: 'Güz' },
            { code: 'EEM417', name: 'Engineering Computations', isMandatory: false, prerequisite: 'BİL200', term: 'Güz' },
            { code: 'EEM457', name: 'Research in Signal Processing I', isMandatory: false, prerequisite: 'EEM301', term: 'Güz' },
            // Bahar
            { code: 'EEM438', name: 'Introduction to AI Processor Design', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM450', name: 'Introduction to System Identification', isMandatory: false, prerequisite: 'EEM301', term: 'Bahar' },
            { code: 'EEM465', name: 'Fundamentals of Data Communications', isMandatory: false, prerequisite: null, term: 'Bahar' },
            { code: 'EEM496', name: 'Communications System Laboratory', isMandatory: false, prerequisite: 'EEM467', term: 'Bahar' },
            { code: 'EEM464', name: 'System-On-Chip (SOC) Design', isMandatory: false, prerequisite: 'EEM334', term: 'Bahar' },
            { code: 'EEM458', name: 'Research in Signal Processing II', isMandatory: false, prerequisite: 'EEM301', term: 'Bahar' }
        ]
    }
];
