#include<iostream>
#include<string>
#include<vector>
#include<windows.h>
class Student //定义一个studnet类
{
    private:
        std::string name;
        int id;
        float score;
    public:
        Student(const std::string& newname, int newid, float newscore);
        const std::string& getName() const;
        int getId() const;
        float getScore() const;
        bool setscore(float newscore);
        void showInfo() const;
};
Student::Student(const std::string& newname,int newid,float newscore):
name(newname),id(newid),score(newscore)
{
    //构造函数
}

int Student::getId() const
{
    return id;
}
float Student::getScore() const
{
    return score;
}
const std::string& Student::getName() const
{
    return name;
}
bool Student::setscore(float newscore)
{
    if(newscore < 0 || newscore > 100)
    {
        return false;
    }
    score = newscore; 
    return true;
}
void Student::showInfo() const
{
    std::cout << name;
    std::cout << id;
    std::cout << score;
}
void addStudent(std::vector<Student>& students)
{
    std::string newname;
    int newid;
    float newscore;
    std::cout << "name:";
    std::cin >> newname;
    std::cout << "id:";
    std::cin >> newid;
    std::cout << "score:";
    std::cin >> newscore;
    students.emplace_back(newname,newid,newscore);
}
void showStudent(std::vector<Student>& students)
{
    if(students.empty())
    {
        std::cout << "You don't have student";
        return;
    }
    for(const auto& stu:students)
    {
        stu.showInfo();
    }
}
void showAverage(std::vector<Student>& students)
{
    if(students.empty())
    {
        std::cout << "You don't have student";
        return;
    }
    float total = 0;
    float Average = 0;
    for(const auto& stu:students)
    {
        total += stu.getScore();
    }
    Average = total / students.size();
    std::cout << Average;
}
void showTopStudent(std::vector<Student>& students)
{
    if(students.empty())
    {
        std::cout << "You don't have student";
        return;
    }
    std::string topname;
    float topscore = 0;
    for(const auto& stu:students)
    {
        if(stu.getScore() >= topscore)
        {
            topscore = stu.getScore();
            topname = stu.getName();
        }
    }
    std::cout << topname << ":" << topscore;
}
void findStudent(std::vector<Student>& students)
{
    std::string newname;
    std::cout << "Please input the name:";
    std::cin >> newname;
    for(const auto& stu:students)
    {
        if(stu.getName() == newname)
        {
            stu.showInfo();
            return;
        }
    }
    std::cout << "Do not find the student";
}
void deleteSudent(std::vector<Student>& students)
{
    int newid;
    std::cout << "Please putin id:";
    std::cin >> newid;
    int i = 0;
    for(i = 0;i < students.size();i++)
    {
        if(students.at(i).getId() == newid)
        {
            std::cout << "Successfully delete the student:" << students.at(i).getId();
            students.erase(students.begin() + i);
            return;
        }
    }
     std::cout << "Do not find the student";
}
void updateScore(std::vector<Student>& students)
{
     
    if(students.empty())
    {
        std::cout << "You don't have student";
        return;
    }
    int newid = 0;
    float newscore = 0;
    std::cout << "Please putin the student id that you'd like to update:";
    std::cin >> newid;
     std::cout << "Please putin the new score that you'd like to update:";
     std::cin >> newscore;
    for(auto& stu:students)
     {
        if(stu.getId() == newid)
        {
            std::cout << "Successfully update";
            stu.setscore(newscore);
            return;
        }
     }
    std::cout << "Do not find the student";
}
int main()
{
    SetConsoleOutputCP(CP_UTF8);
    SetConsoleCP(CP_UTF8);

    std::vector<Student> students;
    int choice;
    do
    {
        std::cout << "\n===== 学生管理系统 3.0 =====\n";
        std::cout << "1. 添加学生\n";
        std::cout << "2. 显示所有学生\n";
        std::cout << "3. 显示平均分\n";
        std::cout << "4. 显示最高分学生\n";
        std::cout << "5. 根据学号查找学生\n";
        std::cout << "6. 根据学号删除学生\n";
        std::cout << "7. 根据学号修改成绩\n";
        std::cout << "0. 退出\n";
        std::cout << "请选择：";
        std::cin >> choice;
        switch(choice)
        {
            case 1:
                addStudent(students);
                break;
            case 2:
                showStudent(students);
                break;
            case 3:
                showAverage(students);
                break;
            case 4:
                showTopStudent(students);
                break;
            case 5:
                findStudent(students);
                break;
            case 6:
                deleteSudent(students);
                break;
            case 7:
                updateScore(students);
                break;
            case 0:
                std::cout << "您已成功退出系统";
                break;
            default:
                std::cout << "无效选择";
        }
    }while(choice != 0);
    return 0;
}
