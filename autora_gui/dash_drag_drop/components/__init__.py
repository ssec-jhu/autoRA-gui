"""
Component definitions for the drag-and-drop workflow builder.
Each component represents a simple arithmetic operation.
"""

from typing import Dict, Any, List, Optional, Union

class BaseComponent:
    """Base class for all workflow components."""
    
    def __init__(self, component_id: str, config: Dict[str, Any] = None):
        self.component_id = component_id
        self.config = config or {}
        self.output_data = None
        self.executed = False
        self.expression = ""
        self.result = None
    
    def execute(self, input_data: Union[int, float] = None) -> Union[int, float]:
        """Execute the component's logic."""
        raise NotImplementedError("Subclasses must implement execute method")
    
    def get_description(self) -> str:
        """Get component description."""
        return "Base component"

class NumberComponent(BaseComponent):
    """Component that outputs a simple number."""
    
    def __init__(self, component_id: str, config: Dict[str, Any] = None):
        super().__init__(component_id, config)
        self.number = self.config.get('number', 5)
        self.expression = str(self.number)
    
    def execute(self, input_data: Union[int, float] = None) -> Union[int, float]:
        """Output the configured number."""
        self.result = self.number
        self.output_data = self.result
        self.executed = True
        return self.result
    
    def get_description(self) -> str:
        return f"Outputs: {self.number}"

class AddComponent(BaseComponent):
    """Component that adds a number to the input."""
    
    def __init__(self, component_id: str, config: Dict[str, Any] = None):
        super().__init__(component_id, config)
        self.add_value = self.config.get('add_value', 3)
        self.expression = f"+ {self.add_value}"
    
    def execute(self, input_data: Union[int, float] = None) -> Union[int, float]:
        """Add the configured value to the input."""
        if input_data is None:
            input_data = 0
        
        self.result = input_data + self.add_value
        self.expression = f"{input_data} + {self.add_value} = {self.result}"
        self.output_data = self.result
        self.executed = True
        return self.result
    
    def get_description(self) -> str:
        return f"Adds {self.add_value} to input"

class MultiplyComponent(BaseComponent):
    """Component that multiplies the input by a number."""
    
    def __init__(self, component_id: str, config: Dict[str, Any] = None):
        super().__init__(component_id, config)
        self.multiply_value = self.config.get('multiply_value', 2)
        self.expression = f"× {self.multiply_value}"
    
    def execute(self, input_data: Union[int, float] = None) -> Union[int, float]:
        """Multiply the input by the configured value."""
        if input_data is None:
            input_data = 1
        
        self.result = input_data * self.multiply_value
        self.expression = f"{input_data} × {self.multiply_value} = {self.result}"
        self.output_data = self.result
        self.executed = True
        return self.result
    
    def get_description(self) -> str:
        return f"Multiplies input by {self.multiply_value}"

class SubtractComponent(BaseComponent):
    """Component that subtracts a number from the input."""
    
    def __init__(self, component_id: str, config: Dict[str, Any] = None):
        super().__init__(component_id, config)
        self.subtract_value = self.config.get('subtract_value', 1)
        self.expression = f"- {self.subtract_value}"
    
    def execute(self, input_data: Union[int, float] = None) -> Union[int, float]:
        """Subtract the configured value from the input."""
        if input_data is None:
            input_data = 0
        
        self.result = input_data - self.subtract_value
        self.expression = f"{input_data} - {self.subtract_value} = {self.result}"
        self.output_data = self.result
        self.executed = True
        return self.result
    
    def get_description(self) -> str:
        return f"Subtracts {self.subtract_value} from input"

class SquareComponent(BaseComponent):
    """Component that squares the input."""
    
    def __init__(self, component_id: str, config: Dict[str, Any] = None):
        super().__init__(component_id, config)
        self.expression = "x²"
    
    def execute(self, input_data: Union[int, float] = None) -> Union[int, float]:
        """Square the input value."""
        if input_data is None:
            input_data = 0
        
        self.result = input_data ** 2
        self.expression = f"{input_data}² = {self.result}"
        self.output_data = self.result
        self.executed = True
        return self.result
    
    def get_description(self) -> str:
        return "Squares the input (x²)"
# Component registry
COMPONENT_TYPES = {
    'number': NumberComponent,
    'add': AddComponent,
    'multiply': MultiplyComponent,
    'subtract': SubtractComponent,
    'square': SquareComponent
}

def create_component(component_type: str, component_id: str, config: Dict[str, Any] = None) -> BaseComponent:
    """Factory function to create components."""
    if component_type not in COMPONENT_TYPES:
        raise ValueError(f"Unknown component type: {component_type}")
    
    return COMPONENT_TYPES[component_type](component_id, config)

def get_component_definitions() -> List[Dict[str, str]]:
    """Get list of available component definitions for the UI."""
    return [
        {
            'type': 'number',
            'title': 'Number (5)',
            'description': 'Outputs the number 5',
            'icon': '5️⃣'
        },
        {
            'type': 'add',
            'title': 'Add (+3)',
            'description': 'Adds 3 to the input',
            'icon': '➕'
        },
        {
            'type': 'multiply',
            'title': 'Multiply (×2)',
            'description': 'Multiplies input by 2',
            'icon': '✖️'
        },
        {
            'type': 'subtract',
            'title': 'Subtract (-1)',
            'description': 'Subtracts 1 from input',
            'icon': '➖'
        },
        {
            'type': 'square',
            'title': 'Square (x²)',
            'description': 'Squares the input',
            'icon': '²'
        }
    ]
