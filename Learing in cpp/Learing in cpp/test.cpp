#include<iostream>
#include <string>
#include <Windows.h>
#include<vector>
//int plus(int a, int b)
//{
//	return a + b;
//}
//int main()
//{
//	std::cout << plus(1, 2);
//	return 0;
//}
struct student
{
	std::string name;
	int ID;
	float score;
};
void addstudent(std::vector<student>& students)
{
	std::string new_name;
	int new_ID;
	float new_score;
	std::cout << "请输入学生姓名：";
	std::cin >> new_name;
	std::cout << "请输入学生学号：";
	std::cin >> new_ID;
	std::cout << "请输入学生成绩：";
	std::cin >> new_score;
	students.push_back({ new_name,new_ID,new_score });
}
void showstudent(std::vector<student> students)
{
	int i = 0;
	if(students.empty())
		{
			std::cout << "没有学生在系统里";
			return;
		}
	for(i = 0;i < students.size();i++)
	{
		std::cout << "\n学生姓名:" << students.at(i).name;
		std::cout << "\n学生学号:" << students.at(i).ID;
		std::cout << "\n学生成绩:" << students.at(i).score;
	}
}
void showaverage(std::vector<student> students)
{
	int i = 0;
	float total = 0;
	float average = 0;
	if(students.empty())
	{
		std::cout << "没有学生在系统内";
		return;
	}
	for(i = 0;i < students.size();i++)
	{
		total += students[i].score;
	}
	average = total / students.size();
	std::cout << "平均分为：" << average;
}；
void showtopstudent(std::vector<student> students)
{
	int i = 0;
	int top = students.at(0).score;
	std::string name = students.at(0).name;
	if(students.empty())
	{
		std::cout << "系统内没有学生";
		return;
	}
	for(i = 0;i < students.size();i++)
	{
		if(top < students[i].score)
		{
			top = students[i].score;
			name = students.at(i).name;
		}
	}
	std::cout << "成绩最高的学生为:" << name;
	std:cout << "ta的分数为:" << top;
}
void findstudent(std::vector<stduent> students)
{
	int new_ID = 0;
	int i = 0;
	std::cout << "请输入学号:";
	std::cin >> new_ID;
	for(i = 0;i < students.size();i++)
	{
		if(new_ID == students.at(i).ID)
		{
			std::cout << "ta的姓名为:" << students.at(i).name;
			std::cout << "ta的成绩为:" << students.at(i),score;
			return;
		}
	}
	std::cout << "没有找到该学生";
}
void deletestudent(std::vector<student> &students)
{
	int i = 0;
	int new_ID = 0;
	std::cout << "请输入学号:";
	std::cin >> new_ID;
	for(i = 0;i < students.size();i++)
	{
		if(students.at(i).ID == new_ID)
		{
			students.erase(students.begin() + i);
			std::cout << "删除成功";
			return;
		}
	}
	std::cout << "没有找到该学生";
}
int main()
{
	SetConsoleOutputCP(CP_UTF8); // 让控制台按 UTF-8 输出
	SetConsoleCP(CP_UTF8);       // 让控制台按 UTF-8 接收输入
	std::vector<student> students;
	int choice;
	do
	{
		std::cout << "===== 学生管理系统 =====\n\t 1. 添加学生\n\t 2. 显示所有学生\n\t 3. 显示平均分\n\t 4. 显示最高分学生\n\t0. 退出\n\t 请选择：";
		std::cin >> choice;
		switch(choice)
		{
		case 1:
		{
			addstudent(students);
			break;
		}
		case 2:
		{
			showstudent(students);
			break;
		}
		case 3:
		{
			showaverage(students);
			break;
		}
		case 4:
		{
			showtopstudent(students);
			break;
		}
		case 5:
		{
			findstudent(students);
			break;
		}
		case 6:
		{
			deletestudent(students);
			break;
		}
		case 0:
		{
			std::cout << "已退出程序";
			break;
		}
		default:
		{
			std::cout << "无效选择";
		}while (choice != 0);
	}
	return 0;
	
}



