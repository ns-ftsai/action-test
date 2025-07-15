# Specify the minimum version of CMake required.
cmake_minimum_required(VERSION 3.10)

# Set the project name.
project(LspTestProject CXX)

# Set the C++ standard to C++17.
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# This is the crucial line that tells CMake to generate
# the compile_commands.json file.
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Add our executable and specify its source file.
add_executable(lsp_test_app main.cpp)
